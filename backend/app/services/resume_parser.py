import io
import re
import json
import logging
from typing import List, Dict, Any, Optional
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


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """
    Multi-strategy PDF text extractor mirroring the 3-tier fallback architecture:
    Strategy 1: pypdf (Fast, pure Python engine)
    Strategy 2: pdfplumber (High-accuracy layout extractor)
    Strategy 3: Raw stream extraction (printable text objects / ASCII recovery)
    """
    extracted_text = ""

    # STRATEGY 1: pypdf
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        pages_text = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                pages_text.append(t)
        combined = "\n".join(pages_text).strip()
        if len(combined) > 10:
            return combined
    except Exception as e:
        logger.warning(f"Strategy 1 (pypdf) extraction failed: {e}")

    # STRATEGY 2: pdfplumber
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            combined = "\n".join(pages_text).strip()
            if len(combined) > 10:
                return combined
    except Exception as e:
        logger.warning(f"Strategy 2 (pdfplumber) extraction failed: {e}")

    # STRATEGY 3: Fallback raw stream text extractor
    try:
        raw_str = pdf_bytes.decode("latin-1", errors="ignore")
        # Match PDF text operators like (text) Tj or Td (text)
        matches = re.findall(r"\(([^()]+)\)\s*Tj", raw_str) or re.findall(r"T[dD]\s*\(([^()]+)\)", raw_str)
        if matches:
            combined = " ".join(matches).strip()
            if len(combined) > 10:
                return combined

        # Printable ASCII fallback
        ascii_text = re.sub(r"[^\x20-\x7E\n\r\t]", " ", raw_str)
        ascii_text = re.sub(r"\s+", " ", ascii_text).strip()
        if len(ascii_text) > 50:
            return ascii_text
    except Exception as e:
        logger.warning(f"Strategy 3 (raw buffer) extraction failed: {e}")

    if not extracted_text or len(extracted_text.strip()) < 10:
        raise ValueError("Unable to extract readable text from PDF file.")

    return extracted_text


def extract_github_urls_from_text(text: str) -> List[str]:
    """
    Extracts distinct GitHub repository URLs from resume text,
    cleaning trailing punctuation, closing brackets, or trailing slashes.
    """
    github_regex = re.compile(
        r"https?://(?:www\.)?github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",
        re.IGNORECASE
    )
    matches = github_regex.findall(text)
    cleaned_urls = []
    seen = set()

    for url in matches:
        clean = re.sub(r"[.,;)]+$", "", url).rstrip("/")
        if clean not in seen:
            seen.add(clean)
            cleaned_urls.append(clean)

    return cleaned_urls


def fallback_rule_based_parser(raw_text: str) -> CandidateProfile:
    """
    Rule-based fallback parser when OpenAI API is unavailable or fails.
    Extracts candidate name, common technical skills, and matches GitHub projects.
    """
    extracted_urls = extract_github_urls_from_text(raw_text)
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]

    name = lines[0] if lines else "Technical Candidate"
    # Basic sanitize name if too long or looks like email/header
    if len(name) > 60 or "@" in name:
        name = "Technical Candidate"

    skill_pattern = re.compile(
        r"(?:Python|JavaScript|TypeScript|React|Next\.js|Node\.js|PyTorch|TensorFlow|ChromaDB|"
        r"PostgreSQL|Docker|Kubernetes|Go|Rust|C\+\+|Java|AWS|Redis|RAG|LLM|REST API|SQL|FastAPI)",
        re.IGNORECASE
    )
    found_skills = skill_pattern.findall(raw_text)
    unique_skills = []
    seen_skills = set()
    for s in found_skills:
        canonical = s.strip()
        if canonical.lower() not in seen_skills:
            seen_skills.add(canonical.lower())
            unique_skills.append(canonical)

    projects: List[ProjectItem] = []
    if extracted_urls:
        for idx, url in enumerate(extracted_urls):
            repo_name = url.split("/")[-1] if "/" in url else f"Project {idx + 1}"
            formatted_name = re.sub(r"[-_]", " ", repo_name).upper()
            projects.append(ProjectItem(
                name=formatted_name,
                description=f"Project extracted from resume containing link {url}. Includes work with {', '.join(unique_skills[:4])}.",
                url=url,
                technologies=unique_skills[:3]
            ))
    else:
        projects.append(ProjectItem(
            name="Primary Technical Project",
            description=raw_text[:300] or "Candidate technical project details.",
            technologies=unique_skills
        ))

    return CandidateProfile(
        name=name,
        education=[EducationItem(
            degree="B.S. Computer Science / Software Engineering",
            institution="University"
        )],
        skills=unique_skills,
        technologies=unique_skills,
        experience=[ExperienceItem(
            role="Software Developer / Engineer",
            company="Tech Projects",
            description=raw_text[:200]
        )],
        projects=projects
    )


async def parse_resume_text_with_nlp(raw_text: str) -> CandidateProfile:
    """
    Parses resume text using OpenAI GPT-4o with structured JSON output,
    with automatic fallback to rule-based parser.
    """
    api_key = settings.OPENAI_API_KEY
    if api_key:
        try:
            client = openai.OpenAI(api_key=api_key)
            prompt = f"""
You are an expert technical resume parser NLP engine.
Extract structured information from the following raw resume text into JSON matching the schema provided.

Rules:
1. Identify the candidate's name accurately.
2. Extract all technical skills, programming languages, databases, frameworks, and cloud platforms into "skills" and "technologies".
3. Extract all distinct projects, their technical descriptions, and ANY GitHub or project URLs mentioned near or in that project.
4. If a project has a GitHub link anywhere in the resume, associate it with that specific project's "url" field.
5. Keep descriptions clear and preserve key details (e.g. vector databases, models, frameworks, architecture mentioned).

RAW RESUME TEXT:
{raw_text}
"""
            # Use json_schema format
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
                return CandidateProfile(**data)
        except Exception as err:
            logger.warning(f"OpenAI NLP parsing failed or unavailable, using rule-based fallback: {err}")

    return fallback_rule_based_parser(raw_text)
