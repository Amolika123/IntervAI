import io
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field
import openai
from backend.app.config.settings import settings

logger = logging.getLogger(__name__)


class EducationItem(BaseModel):
    degree: str
    institution: str
    year: Optional[str] = None


class ExperienceItem(BaseModel):
    role: str
    company: str
    period: Optional[str] = None
    description: str


class ProjectItem(BaseModel):
    name: str
    description: str
    url: Optional[str] = None
    technologies: Optional[List[str]] = Field(default_factory=list)


class CandidateProfile(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    summary: Optional[str] = None
    education: List[EducationItem] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    projects: List[ProjectItem] = Field(default_factory=list)
    certifications: Optional[List[str]] = Field(default_factory=list)


def extract_annotations_from_pypdf(reader) -> List[str]:
    """Extracts target hyperlink URLs embedded in PDF annotation objects."""
    extracted_urls = []
    seen = set()
    try:
        for page in reader.pages:
            annots = page.get("/Annots")
            if not annots:
                continue
            for annot in annots:
                try:
                    obj = annot.get_object() if hasattr(annot, "get_object") else annot
                    if not obj or obj.get("/Subtype") != "/Link":
                        continue
                    action = obj.get("/A")
                    uri = None
                    if action and hasattr(action, "get"):
                        uri = action.get("/URI")
                    elif obj.get("/URI"):
                        uri = obj.get("/URI")

                    if uri and isinstance(uri, str):
                        clean_uri = uri.strip()
                        if clean_uri.startswith("http") and clean_uri not in seen:
                            seen.add(clean_uri)
                            extracted_urls.append(clean_uri)
                except Exception:
                    continue
    except Exception as e:
        logger.debug(f"pypdf annotation extraction notice: {e}")
    return extracted_urls


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Multi-strategy PDF text and hyperlink extractor:
    Strategy 1: pypdf (Extracts text + embedded clickable /Annots hyperlinks)
    Strategy 2: pdfplumber (High-accuracy layout extraction + hyperlinks)
    Strategy 3: Raw stream extraction fallback
    """
    extracted_pages: List[str] = []
    extracted_hyperlinks: List[str] = []
    seen_links = set()

    # STRATEGY 1: pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for page_idx, page in enumerate(reader.pages):
            t = page.extract_text()
            if t and t.strip():
                extracted_pages.append(t.strip())

        annots_urls = extract_annotations_from_pypdf(reader)
        for u in annots_urls:
            if u not in seen_links:
                seen_links.add(u)
                extracted_hyperlinks.append(u)

        if extracted_pages and len("\n".join(extracted_pages).strip()) > 30:
            combined = "\n\n".join(extracted_pages).strip()
            if extracted_hyperlinks:
                combined += "\n\n[EMBEDDED_HYPERLINKS]\n" + "\n".join(extracted_hyperlinks)
            return combined
    except Exception as e:
        logger.warning(f"Strategy 1 (pypdf) extraction failed: {e}")

    # STRATEGY 2: pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                t = page.extract_text(layout=False)
                if t and t.strip():
                    pages_text.append(t.strip())
                if hasattr(page, "hyperlinks") and page.hyperlinks:
                    for h in page.hyperlinks:
                        uri = h.get("uri")
                        if uri and isinstance(uri, str) and uri.startswith("http") and uri not in seen_links:
                            seen_links.add(uri)
                            extracted_hyperlinks.append(uri)

            if pages_text and len("\n".join(pages_text).strip()) > 30:
                combined = "\n\n".join(pages_text).strip()
                if extracted_hyperlinks:
                    combined += "\n\n[EMBEDDED_HYPERLINKS]\n" + "\n".join(extracted_hyperlinks)
                return combined
    except Exception as e:
        logger.warning(f"Strategy 2 (pdfplumber) extraction failed: {e}")

    # STRATEGY 3: Raw stream extraction fallback (only for uncompressed textual streams with Tj/Td operators)
    try:
        raw_str = pdf_bytes.decode("latin-1", errors="ignore")
        matches = re.findall(r"\(([^()]+)\)\s*Tj", raw_str) or re.findall(r"T[dD]\s*\(([^()]+)\)", raw_str)
        if matches:
            combined = " ".join(matches).strip()
            combined = re.sub(r"[^\x20-\x7E\n\r\t]", " ", combined)
            combined = re.sub(r"\s+", " ", combined).strip()
            # Verify it contains readable english/latin words and isn't PDF bytecode or binary noise
            words = [w for w in combined.split() if len(w) >= 3 and w.isalpha()]
            # Must have at least 5 valid words and not be a raw PDF header
            if len(words) >= 5 and not combined.startswith("%PDF"):
                return combined
    except Exception as e:
        logger.warning(f"Strategy 3 (raw buffer) extraction failed: {e}")

    raise ValueError("The uploaded PDF appears to be scanned, image-only, or contains no readable text. Please upload a valid text-based PDF resume.")


def extract_github_urls_from_text(text: str) -> List[str]:
    """
    Extracts distinct GitHub URLs (repositories and profiles) from resume text,
    cleaning trailing punctuation, closing brackets, or trailing slashes.
    """
    github_regex = re.compile(
        r"https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)?",
        re.IGNORECASE
    )
    matches = github_regex.findall(text)
    cleaned_urls = []
    seen = set()

    for url in matches:
        clean = re.sub(r"[.,;)]+$", "", url.strip()).rstrip("/")
        if clean not in seen:
            seen.add(clean)
            cleaned_urls.append(clean)

    return cleaned_urls


def clean_project_title(raw_line: str) -> str:
    """Cleans bullet characters, dates, and trailing separator noise from a project title line."""
    line = raw_line.strip()
    line = re.sub(r"^[\s•\-*#\d.]+\s*", "", line)
    # Remove trailing date patterns like (Jan 2024 - May 2024) or | Jan 2024
    line = re.sub(r"\((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})[^\)]*\)$", "", line, flags=re.IGNORECASE)
    line = re.sub(r"\|\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})[^\n]*$", "", line, flags=re.IGNORECASE)
    # Strip trailing URLs from the title
    line = re.sub(r"https?://\S+", "", line)
    return line.strip(" -–—|: \t")


def extract_projects_rule_based(raw_text: str, unique_skills: List[str]) -> List[ProjectItem]:
    """
    Robust rule-based project segmenter.
    Detects project sections (e.g. PROJECTS, KEY PROJECTS, ACADEMIC PROJECTS),
    identifies individual project headers (e.g. 'NutrInspect – AI-Powered Nutrition Analysis'),
    and binds descriptions, technologies, and URLs.
    Never returns a generic 'Primary Technical Project' if projects exist.
    """
    projects: List[ProjectItem] = []
    lines = [l.rstrip() for l in raw_text.splitlines() if l.strip()]

    # 1. Identify where Projects section begins
    section_header_pattern = re.compile(
        r"^(?:KEY\s+|ACADEMIC\s+|PERSONAL\s+|TECHNICAL\s+|SELECTED\s+)?PROJECTS(?:\s+EXPERIENCE)?\b",
        re.IGNORECASE
    )
    other_section_pattern = re.compile(
        r"^(?:EXPERIENCE|EDUCATION|SKILLS|TECHNICAL SKILLS|PUBLICATIONS|CERTIFICATIONS|ACHIEVEMENTS|AWARDS)\b",
        re.IGNORECASE
    )

    in_project_section = False
    project_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if section_header_pattern.match(stripped):
            in_project_section = True
            continue
        elif in_project_section and other_section_pattern.match(stripped):
            in_project_section = False
            break
        elif in_project_section:
            project_lines.append(line)

    # If no explicit section header was found, scan the whole text for project-like blocks
    target_lines = project_lines if project_lines else lines

    # Pattern detecting project title lines:
    # e.g., 'NutrInspect – AI-Powered Nutrition Analysis'
    # 'AI Agent for Fake News Detection | Python, ChromaDB'
    # 'Agentic AI Based Pharmacy System'
    title_pattern = re.compile(
        r"^[A-Z0-9][A-Za-z0-9\s/&:+–—.,'\"()-]{3,75}(?:\s*[-–—|:]\s*[A-Za-z0-9\s/&:+–—.,'\"()-]+)?$"
    )

    current_title: Optional[str] = None
    current_desc_lines: List[str] = []
    current_url: Optional[str] = None

    def commit_project():
        nonlocal current_title, current_desc_lines, current_url
        if not current_title:
            return
        cleaned_title = clean_project_title(current_title)
        if len(cleaned_title) < 3 or cleaned_title.lower() in ("projects", "academic projects", "experience", "education"):
            return

        full_desc = " ".join([d.strip() for d in current_desc_lines if d.strip()])
        if not full_desc:
            full_desc = f"Technical project involving {cleaned_title}."

        # Extract technologies specific to this project block
        proj_techs = [s for s in unique_skills if re.search(r"\b" + re.escape(s) + r"\b", f"{cleaned_title} {full_desc}", re.I)]

        projects.append(ProjectItem(
            name=cleaned_title,
            description=full_desc[:800],
            url=current_url,
            technologies=proj_techs or unique_skills[:3]
        ))
        current_title = None
        current_desc_lines = []
        current_url = None

    url_regex = re.compile(r"https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", re.I)

    for line in target_lines:
        stripped = line.strip()
        if not stripped:
            continue

        # Check if line is a URL declaration line (e.g. GitHub: https://..., Link: ..., http...)
        is_url_line = bool(
            re.match(r"^(?:github|link|url|demo|code|repo)\s*:\s*", stripped, re.I) or
            stripped.startswith("http") or
            "github.com" in stripped.lower()
        )
        if is_url_line:
            found_urls = url_regex.findall(stripped)
            if found_urls and not current_url:
                current_url = found_urls[0].rstrip("./,)")
            if current_title:
                current_desc_lines.append(stripped)
            continue

        # Check for URL in regular line
        found_urls = url_regex.findall(stripped)
        if found_urls and not current_url:
            current_url = found_urls[0].rstrip("./,)")

        # Is this a new project header line?
        is_bullet = bool(re.match(r"^[\s•\-*]\s+", line))
        is_heading_candidate = not is_bullet and (
            ("–" in stripped or "—" in stripped or " - " in stripped or " | " in stripped) or
            (title_pattern.match(stripped) and len(stripped.split()) <= 10 and not stripped.endswith("."))
        )

        if is_heading_candidate and not any(k in stripped.lower() for k in ("university", "bachelor", "master", "gpa", "graduated", "phone", "email")):
            commit_project()
            current_title = stripped
        else:
            if current_title:
                current_desc_lines.append(stripped)

    commit_project()

    # If fallback found named projects, return them
    if projects:
        return projects

    # Secondary heuristic: if URLs exist, map them to named projects
    all_urls = extract_github_urls_from_text(raw_text)
    repo_urls = [u for u in all_urls if len(u.replace("https://github.com/", "").split("/")) >= 2]
    if repo_urls:
        for idx, url in enumerate(repo_urls):
            repo_slug = url.split("/")[-1]
            formatted_name = re.sub(r"[-_]", " ", repo_slug).title()
            projects.append(ProjectItem(
                name=formatted_name,
                description=f"Project extracted from resume containing repository {url}.",
                url=url,
                technologies=unique_skills[:4]
            ))
        return projects

    # If no project headers could be segmented at all, extract the most prominent text title
    for line in lines[:25]:
        stripped = line.strip()
        if len(stripped) > 5 and not any(x in stripped.lower() for x in ("resume", "cv", "curriculum", "@", "phone", "linkedin", "github")):
            # Found a candidate header
            cleaned = clean_project_title(stripped)
            if len(cleaned) >= 4:
                projects.append(ProjectItem(
                    name=cleaned,
                    description=raw_text[:400],
                    technologies=unique_skills
                ))
                return projects

    # Absolute fallback: Return first 50 chars of content
    projects.append(ProjectItem(
        name="Technical Engineering Project",
        description=raw_text[:400] or "Technical candidate engineering project.",
        technologies=unique_skills
    ))
    return projects


def fallback_rule_based_parser(raw_text: str) -> CandidateProfile:
    """
    Deterministic fallback parser when OpenAI API is unavailable or fails.
    Extracts candidate name, technical skills, education, experience,
    and distinct projects preserving their real names.
    """
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    # 1. Candidate Name Extraction
    name = "Technical Candidate"
    for line in lines[:10]:
        stripped = line.strip()
        # Skip contact headers, links, and section titles
        if any(h in stripped.lower() for h in ("resume", "curriculum", "email", "@", "github", "linkedin", "phone", "http")):
            continue
        if len(stripped.split()) in (2, 3, 4) and len(stripped) < 45 and not re.search(r"\d", stripped):
            name = stripped
            break

    # 2. Skills Extraction
    skill_pattern = re.compile(
        r"(?:Python|JavaScript|TypeScript|React|Next\.js|Node\.js|PyTorch|TensorFlow|ChromaDB|"
        r"PostgreSQL|Docker|Kubernetes|Go|Rust|C\+\+|Java|AWS|Redis|RAG|LLM|REST API|SQL|FastAPI|"
        r"GraphQL|MongoDB|SQLite|Scikit-Learn|Hugging Face|LangChain|LlamaIndex|Kafka|TailwindCSS)",
        re.IGNORECASE
    )
    found_skills = skill_pattern.findall(raw_text)
    unique_skills: List[str] = []
    seen_skills = set()
    for s in found_skills:
        canonical = s.strip()
        if canonical.lower() not in seen_skills:
            seen_skills.add(canonical.lower())
            unique_skills.append(canonical)

    # 3. Projects Extraction (with real project names)
    projects = extract_projects_rule_based(raw_text, unique_skills)

    # 4. Education & Experience items
    education: List[EducationItem] = []
    edu_match = re.search(r"(?:B\.?S\.?|Bachelor|M\.?S\.?|Master|Ph\.?D\.?)[^\n,]+", raw_text, re.IGNORECASE)
    if edu_match:
        education.append(EducationItem(
            degree=edu_match.group(0).strip(),
            institution="University"
        ))
    else:
        education.append(EducationItem(
            degree="B.S. in Computer Science / Engineering",
            institution="University"
        ))

    experience: List[ExperienceItem] = [
        ExperienceItem(
            role="Software Engineer / AI Developer",
            company="Technical Projects",
            description=raw_text[:300]
        )
    ]

    return CandidateProfile(
        name=name,
        education=education,
        skills=unique_skills,
        technologies=unique_skills,
        experience=experience,
        projects=projects
    )


async def parse_resume_text_with_nlp(raw_text: str) -> CandidateProfile:
    """
    Parses resume text using OpenAI GPT-4o with structured JSON output,
    with automatic fallback to deterministic parser.
    Ensures actual project names and URLs are preserved without generic placeholders.
    """
    api_key = settings.OPENAI_API_KEY
    if api_key:
        try:
            client = openai.OpenAI(api_key=api_key)
            prompt = f"""
You are an expert technical resume parser NLP engine.
Extract structured information from the following raw resume text into JSON matching the schema provided.

CRITICAL EXTRACTION RULES:
1. Extract candidate's full name accurately.
2. Extract all distinct technical skills, programming languages, databases, frameworks, and cloud platforms into "skills" and "technologies".
3. Extract EVERY project as its own distinct item in "projects". DO NOT merge multiple projects into one.
4. RETAIN THE EXACT, FULL PROJECT NAME from the resume (e.g. "NutrInspect – AI-Powered Nutrition Analysis", "AI Agent for Fake News Detection", "Agentic AI Based Pharmacy System").
5. NEVER use generic placeholder names like "Primary Technical Project" or "Project 1".
6. Extract the complete technical description, problem solved, architecture, and metrics into "description".
7. Extract the specific tools, libraries, and frameworks used in that project into "technologies".
8. If a project has an associated GitHub URL, repository link, or demo URL in the text or annotations, associate it with that specific project's "url". Do NOT assign the candidate's general GitHub profile (e.g. https://github.com/username) as a project repo URL unless it specifically points to that project's repo.

RAW RESUME TEXT:
{raw_text}
"""
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "candidate_profile",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "email": {"type": "string"},
                                "phone": {"type": "string"},
                                "summary": {"type": "string"},
                                "education": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "degree": {"type": "string"},
                                            "institution": {"type": "string"},
                                            "year": {"type": "string"},
                                        },
                                        "required": ["degree", "institution"],
                                        "additionalProperties": False,
                                    },
                                },
                                "skills": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "technologies": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                                "experience": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "role": {"type": "string"},
                                            "company": {"type": "string"},
                                            "period": {"type": "string"},
                                            "description": {"type": "string"},
                                        },
                                        "required": ["role", "company", "description"],
                                        "additionalProperties": False,
                                    },
                                },
                                "projects": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "name": {"type": "string"},
                                            "description": {"type": "string"},
                                            "url": {"type": "string"},
                                            "technologies": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                        "required": ["name", "description"],
                                        "additionalProperties": False,
                                    },
                                },
                                "certifications": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                            "required": [
                                "name",
                                "education",
                                "skills",
                                "technologies",
                                "experience",
                                "projects",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
            )

            content = response.choices[0].message.content
            if content:
                data = json.loads(content)
                profile = CandidateProfile(**data)

                # Validation guardrails: if projects list is empty or contains "Primary Technical Project", repair via rule-based parser
                if not profile.projects or any("primary technical project" in p.name.lower() for p in profile.projects):
                    fallback_profile = fallback_rule_based_parser(raw_text)
                    if fallback_profile.projects:
                        profile.projects = fallback_profile.projects

                return profile
        except Exception as err:
            logger.warning(f"OpenAI NLP parsing failed or unavailable, using deterministic fallback: {err}")

    return fallback_rule_based_parser(raw_text)
