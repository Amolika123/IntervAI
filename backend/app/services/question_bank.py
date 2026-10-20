import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import openai

from backend.app.config.settings import settings
from backend.app.config.interview_styles import get_style_config
from backend.app.db.models import (
    Interview,
    InterviewQuestion,
    InterviewAnswer,
    InterviewPlannedQuestion,
    Project,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Anti-Repetition Engine
# ---------------------------------------------------------------------------

STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "which", "who", "whom", "this", "that", "these", "those", "am", "is",
    "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "having", "do", "does", "did", "doing", "would", "should", "could",
    "ought", "i", "you", "he", "she", "it", "we", "they", "your", "my",
    "our", "their", "can", "tell", "me", "about", "walk", "through",
    "explain", "how", "why", "did", "for", "in", "to", "of", "with",
    "at", "by", "from", "up", "about", "into", "over", "after"
}

QUESTION_INTENT_PATTERNS = {
    "CHOICE_OR_SELECTION": re.compile(
        r"(?:why\s+did\s+you\s+(?:choose|select|pick|decide\s+to\s+use)|"
        r"what\s+(?:was|were)\s+the\s+reason[s]?\s+for\s+(?:choosing|selecting|picking|using)|"
        r"why\s+(?:choose|select|use)|what\s+led\s+you\s+to\s+(?:choose|select|pick))",
        re.IGNORECASE
    ),
    "ARCHITECTURE": re.compile(
        r"(?:high[- ]level\s+architecture|system\s+architecture|overall\s+design|architectural\s+decisions?|how\s+is\s+the\s+system\s+structured)",
        re.IGNORECASE
    ),
    "COMPLEXITY_AND_PERF": re.compile(
        r"(?:time\s+and\s+space\s+complexity|computational\s+complexity|big[- ]o|runtime\s+performance|latency\s+at\s+scale|bottleneck[s]?)",
        re.IGNORECASE
    ),
    "EDGE_CASES": re.compile(
        r"(?:edge\s+cases?|boundary\s+(?:inputs?|conditions?)|malformed\s+(?:data|inputs?)|unexpected\s+inputs?)",
        re.IGNORECASE
    ),
    "FAILURE_HANDLING": re.compile(
        r"(?:failure\s+(?:scenarios?|modes?)|upstream\s+timeout|fault\s+tolerance|error\s+recovery|fallback\s+mechanism)",
        re.IGNORECASE
    ),
    "DATABASE_AND_APIS": re.compile(
        r"(?:database\s+schema|query\s+indexing|api\s+contracts?|data\s+consistency|relational\s+model)",
        re.IGNORECASE
    ),
    "DEBUGGING_OBSERVABILITY": re.compile(
        r"(?:logging|monitoring|observability|debugging\s+workflows?|troubleshooting|diagnose\s+issues?)",
        re.IGNORECASE
    ),
}


def normalize_text_for_comparison(text: str) -> str:
    """Lowercases, strips punctuation, and collapses whitespace."""
    clean = re.sub(r"[^\w\s]", " ", text.lower())
    return re.sub(r"\s+", " ", clean).strip()


def extract_keywords(text: str) -> set:
    """Extracts non-stop-word tokens of length >= 3."""
    words = normalize_text_for_comparison(text).split()
    return {w for w in words if w not in STOP_WORDS and len(w) >= 3}


def detect_question_intent(text: str) -> Optional[str]:
    """Classifies the primary question intent based on phrasing."""
    for intent_name, pattern in QUESTION_INTENT_PATTERNS.items():
        if pattern.search(text):
            return intent_name
    return None


def extract_technical_subjects(text: str, candidate_context: Optional[Dict[str, Any]] = None) -> set:
    """Extracts specific tools, technologies, and project names mentioned in the question."""
    found = set()
    norm = text.lower()

    # Check against known candidate technologies and projects if provided
    if candidate_context:
        for p in candidate_context.get("projects", []):
            p_name = p.get("name", "").lower()
            if p_name and p_name in norm:
                found.add(p_name)
            for t in p.get("technologies", []):
                if t.lower() in norm:
                    found.add(t.lower())

        cand = candidate_context.get("candidate", {})
        for s in cand.get("skills", []) + cand.get("technologies", []):
            if s.lower() in norm:
                found.add(s.lower())

    # Common technical terms
    common_entities = [
        "chromadb", "faiss", "pgvector", "pinecone", "qdrant", "weaviate",
        "pytorch", "tensorflow", "fastapi", "flask", "django", "next.js",
        "react", "postgresql", "mysql", "sqlite", "redis", "mongodb",
        "docker", "kubernetes", "langchain", "llamaindex", "kafka", "rabbitmq"
    ]
    for entity in common_entities:
        if re.search(r"\b" + re.escape(entity) + r"\b", norm):
            found.add(entity)

    return found


def is_duplicate_or_repetitive(
    candidate_question: str,
    asked_questions: List[str],
    candidate_context: Optional[Dict[str, Any]] = None
) -> Tuple[bool, str]:
    """
    Evaluates whether a candidate question is an exact, token-level, or semantic duplicate
    of any previously asked question.

    Returns (is_duplicate, reason).
    """
    norm_new = normalize_text_for_comparison(candidate_question)
    new_tokens = extract_keywords(candidate_question)
    new_intent = detect_question_intent(candidate_question)
    new_subjects = extract_technical_subjects(candidate_question, candidate_context)

    for asked in asked_questions:
        norm_asked = normalize_text_for_comparison(asked)

        # 1. Exact or near-exact match
        if norm_new == norm_asked:
            return True, f"Exact match with asked question: '{asked}'"

        # 2. Token Jaccard similarity check
        asked_tokens = extract_keywords(asked)
        if new_tokens and asked_tokens:
            intersection = new_tokens.intersection(asked_tokens)
            union = new_tokens.union(asked_tokens)
            jaccard = len(intersection) / len(union) if union else 0.0
            if jaccard >= 0.70:
                return True, f"High token overlap ({jaccard:.2f}) with asked question: '{asked}'"

        # 3. Semantic Duplicate Detection:
        # If both questions share the exact same intent (e.g. CHOICE_OR_SELECTION)
        # AND share the same technical subject entity (e.g. ChromaDB), they are semantic duplicates!
        # E.g. "What was the reason for choosing ChromaDB?" vs "Why did you select ChromaDB?"
        asked_intent = detect_question_intent(asked)
        asked_subjects = extract_technical_subjects(asked, candidate_context)

        if new_intent and asked_intent and (new_intent == asked_intent):
            common_subjects = new_subjects.intersection(asked_subjects)
            if common_subjects:
                return True, (
                    f"Semantic duplicate detected. Both probe intent '{new_intent}' "
                    f"on subject(s) {common_subjects}. Asked: '{asked}'"
                )

    return False, "Distinct question"


# ---------------------------------------------------------------------------
# Question Bank Generation
# ---------------------------------------------------------------------------

def generate_deterministic_question_bank(
    candidate_context: Dict[str, Any],
    style_id: str
) -> List[Dict[str, Any]]:
    """
    Deterministic style-calibrated question bank generator creating 8-12
    grounded questions across candidate projects, technologies, and experience.
    """
    style_config = get_style_config(style_id)
    cand = candidate_context.get("candidate", {})
    candidate_name = cand.get("name", "Candidate")
    projects = candidate_context.get("projects", [])
    skills = cand.get("skills", [])
    primary_skill = skills[0] if skills else "Python"

    bank: List[Dict[str, Any]] = []

    valid_projects = [
        p for p in projects
        if p.get("name") and not any(ph in p.get("name", "").lower() for ph in ("primary technical project", "unknown project", "general experience"))
    ]
    effective_projects = valid_projects if valid_projects else projects

    p1 = effective_projects[0] if len(effective_projects) > 0 else None
    p2 = effective_projects[1] if len(effective_projects) > 1 else None
    p3 = effective_projects[2] if len(effective_projects) > 2 else None

    p1_name = p1.get("name") if p1 and p1.get("name") else "your core project"
    p2_name = p2.get("name") if p2 and p2.get("name") else None
    p3_name = p3.get("name") if p3 and p3.get("name") else None

    # Question 1: Personalized Technical Opening Question (No generic greeting)
    if style_id == "FAANG":
        bank.append({
            "order": 1,
            "questionText": (
                f"Hello {candidate_name}. To begin our technical discussion in {p1_name}, "
                f"walk me through the core implementation details and the primary data structures you chose."
            ),
            "category": "implementation",
            "groundingSource": f"project:{p1_name}:implementation_mechanics",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 2,
            "questionText": (
                f"In {p1_name}, what were the most critical computational bottlenecks, "
                f"and how does the algorithmic time and space complexity scale as input data grows?"
            ),
            "category": "COMPLEXITY_AND_PERF",
            "groundingSource": f"project:{p1_name}:complexity_analysis",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 3,
            "questionText": (
                f"What boundary conditions, edge cases, and corrupted inputs did you account for in {p1_name}, "
                f"and how did your validation logic prevent unexpected runtime exceptions?"
            ),
            "category": "EDGE_CASES",
            "groundingSource": f"project:{p1_name}:edge_cases",
            "projectId": p1.get("id") if p1 else None
        })
        if p2_name:
            bank.append({
                "order": 4,
                "questionText": (
                    f"Transitioning to another project on your resume, {p2_name}. "
                    f"How did you structure the data flow and optimize data structure access patterns for latency?"
                ),
                "category": "COMPLEXITY_AND_PERF",
                "groundingSource": f"project:{p2_name}:data_structures",
                "projectId": p2.get("id") if p2 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"When profiling {p2_name}, what specific memory or CPU bottlenecks did you encounter, "
                    f"and what optimizations did you implement to resolve them?"
                ),
                "category": "COMPLEXITY_AND_PERF",
                "groundingSource": f"project:{p2_name}:optimization",
                "projectId": p2.get("id") if p2 else None
            })
        else:
            bank.append({
                "order": 4,
                "questionText": (
                    f"In {p1_name}, how did you manage memory allocation and computational overhead "
                    f"during intensive data transformations?"
                ),
                "category": "COMPLEXITY_AND_PERF",
                "groundingSource": f"project:{p1_name}:memory_management",
                "projectId": p1.get("id") if p1 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"How did you implement automated unit and integration tests in {p1_name} "
                    f"to verify boundary conditions and prevent algorithmic regressions?"
                ),
                "category": "implementation",
                "groundingSource": f"project:{p1_name}:automated_testing",
                "projectId": p1.get("id") if p1 else None
            })
        if p3_name:
            bank.append({
                "order": 6,
                "questionText": (
                    f"Examining {p3_name}, can you walk me through the algorithmic design "
                    f"and how you ensured robust execution under concurrent requests?"
                ),
                "category": "implementation",
                "groundingSource": f"project:{p3_name}:concurrency_algorithms",
                "projectId": p3.get("id") if p3 else None
            })
        else:
            bank.append({
                "order": 6,
                "questionText": (
                    f"How does {p1_name} guarantee thread safety and prevent race conditions "
                    f"when processing simultaneous asynchronous workloads?"
                ),
                "category": "COMPLEXITY_AND_PERF",
                "groundingSource": f"project:{p1_name}:thread_safety",
                "projectId": p1.get("id") if p1 else None
            })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"Given your experience with {primary_skill}, how do you evaluate the Big-O trade-offs "
                f"between in-memory caching and persistent storage retrieval under high throughput?"
            ),
            "category": "COMPLEXITY_AND_PERF",
            "groundingSource": f"resume:skills:{primary_skill}",
            "projectId": None
        })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"If you had to refactor {p1_name} to process 100x the current data volume, "
                f"which algorithmic components would break first and what would be your redesign strategy?"
            ),
            "category": "ARCHITECTURE",
            "groundingSource": f"project:{p1_name}:scaling_refactor",
            "projectId": p1.get("id") if p1 else None
        })

    elif style_id == "MANGOS":
        bank.append({
            "order": 1,
            "questionText": (
                f"Hello {candidate_name}. Let's examine the architectural foundation of {p1_name}. "
                f"Can you walk me through the high-level system architecture and the first-principles trade-offs behind your stack?"
            ),
            "category": "ARCHITECTURE",
            "groundingSource": f"project:{p1_name}:architecture_tradeoffs",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 2,
            "questionText": (
                f"In {p1_name}, what alternative system architectures or model designs did you consider, "
                f"and why did you select this architecture over the alternatives?"
            ),
            "category": "CHOICE_OR_SELECTION",
            "groundingSource": f"project:{p1_name}:design_selection",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 3,
            "questionText": (
                f"In a catastrophic production failure—such as an upstream dependency timeout, API rate limit, or corrupted payload—how does {p1_name} recover gracefully?"
            ),
            "category": "FAILURE_HANDLING",
            "groundingSource": f"project:{p1_name}:fault_tolerance",
            "projectId": p1.get("id") if p1 else None
        })
        if p2_name:
            bank.append({
                "order": 4,
                "questionText": (
                    f"Looking at {p2_name}, how did you design the subsystem boundaries, "
                    f"and what hardware or compute constraints influenced your choices?"
                ),
                "category": "ARCHITECTURE",
                "groundingSource": f"project:{p2_name}:subsystem_architecture",
                "projectId": p2.get("id") if p2 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"How do you evaluate and monitor model or system performance in {p2_name} "
                    f"to detect silent degradation or degraded retrieval precision?"
                ),
                "category": "DEBUGGING_OBSERVABILITY",
                "groundingSource": f"project:{p2_name}:evaluation_metrics",
                "projectId": p2.get("id") if p2 else None
            })
        else:
            bank.append({
                "order": 4,
                "questionText": (
                    f"In {p1_name}, how did you decouple stateful and stateless components "
                    f"to facilitate horizontal scaling and fast failover?"
                ),
                "category": "ARCHITECTURE",
                "groundingSource": f"project:{p1_name}:distributed_scalability",
                "projectId": p1.get("id") if p1 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"How do you monitor and observe production latency percentiles (p95, p99) "
                    f"and error budgets in {p1_name}?"
                ),
                "category": "DEBUGGING_OBSERVABILITY",
                "groundingSource": f"project:{p1_name}:latency_monitoring",
                "projectId": p1.get("id") if p1 else None
            })
        if p3_name:
            bank.append({
                "order": 6,
                "questionText": (
                    f"In {p3_name}, how does your architecture decouple stateful and stateless components "
                    f"to facilitate horizontal scaling under distributed load?"
                ),
                "category": "ARCHITECTURE",
                "groundingSource": f"project:{p3_name}:distributed_scalability",
                "projectId": p3.get("id") if p3 else None
            })
        else:
            bank.append({
                "order": 6,
                "questionText": (
                    f"What strategy does {p1_name} use for data partitioning, message queuing, "
                    f"or connection pooling under sudden spikes in incoming traffic?"
                ),
                "category": "ARCHITECTURE",
                "groundingSource": f"project:{p1_name}:traffic_partitioning",
                "projectId": p1.get("id") if p1 else None
            })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"When working with {primary_skill} in distributed environments, how do you handle "
                f"eventual consistency and network partition trade-offs?"
            ),
            "category": "ARCHITECTURE",
            "groundingSource": f"resume:skills:distributed_systems",
            "projectId": None
        })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"Reflecting on the architecture of {p1_name}, what was the single biggest engineering compromise you had to make, "
                f"and how would you re-architect it with unconstrained compute resources?"
            ),
            "category": "ARCHITECTURE",
            "groundingSource": f"project:{p1_name}:architecture_evolution",
            "projectId": p1.get("id") if p1 else None
        })

    else:  # BIG_4
        bank.append({
            "order": 1,
            "questionText": (
                f"Hello {candidate_name}. Let's examine the practical software engineering behind {p1_name}. "
                f"Can you walk me through the database schemas, API contracts, and core application services you built?"
            ),
            "category": "DATABASE_AND_APIS",
            "groundingSource": f"project:{p1_name}:database_and_apis",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 2,
            "questionText": (
                f"How did you structure your database schemas, relations, and query indexing in {p1_name} "
                f"to guarantee data integrity and query efficiency?"
            ),
            "category": "DATABASE_AND_APIS",
            "groundingSource": f"project:{p1_name}:schema_integrity",
            "projectId": p1.get("id") if p1 else None
        })
        bank.append({
            "order": 3,
            "questionText": (
                f"When unexpected errors or production failures occur in {p1_name}, what structured logging, "
                f"monitoring, and debugging workflows do you use to diagnose the root cause?"
            ),
            "category": "DEBUGGING_OBSERVABILITY",
            "groundingSource": f"project:{p1_name}:debugging_observability",
            "projectId": p1.get("id") if p1 else None
        })
        if p2_name:
            bank.append({
                "order": 4,
                "questionText": (
                    f"Moving to {p2_name}. How do your API endpoints handle input validation, "
                    f"standardized error responses, and client authentication?"
                ),
                "category": "DATABASE_AND_APIS",
                "groundingSource": f"project:{p2_name}:api_standards",
                "projectId": p2.get("id") if p2 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"In {p2_name}, what strategies did you employ to ensure maintainability, "
                    f"code readability, and seamless onboarding for other engineers?"
                ),
                "category": "implementation",
                "groundingSource": f"project:{p2_name}:maintainability",
                "projectId": p2.get("id") if p2 else None
            })
        else:
            bank.append({
                "order": 4,
                "questionText": (
                    f"In {p1_name}, how do your API endpoints handle input validation, "
                    f"standardized error responses, and client authentication?"
                ),
                "category": "DATABASE_AND_APIS",
                "groundingSource": f"project:{p1_name}:api_standards",
                "projectId": p1.get("id") if p1 else None
            })
            bank.append({
                "order": 5,
                "questionText": (
                    f"In {p1_name}, what strategies did you employ to ensure maintainability, "
                    f"code readability, and clean modular architecture for team collaboration?"
                ),
                "category": "implementation",
                "groundingSource": f"project:{p1_name}:maintainability",
                "projectId": p1.get("id") if p1 else None
            })
        if p3_name:
            bank.append({
                "order": 6,
                "questionText": (
                    f"Examining {p3_name}, how did you enforce transactional boundaries "
                    f"and avoid race conditions or dirty reads during concurrent operations?"
                ),
                "category": "DATABASE_AND_APIS",
                "groundingSource": f"project:{p3_name}:transactions_concurrency",
                "projectId": p3.get("id") if p3 else None
            })
        else:
            bank.append({
                "order": 6,
                "questionText": (
                    f"Examining {p1_name}, how did you enforce transactional boundaries "
                    f"and avoid race conditions or dirty reads during concurrent operations?"
                ),
                "category": "DATABASE_AND_APIS",
                "groundingSource": f"project:{p1_name}:transactions_concurrency",
                "projectId": p1.get("id") if p1 else None
            })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"Given your practical work with {primary_skill}, what automated testing practices (unit, integration, regression) "
                f"did you implement to prevent regressions in production?"
            ),
            "category": "implementation",
            "groundingSource": f"resume:skills:testing_qa",
            "projectId": None
        })
        bank.append({
            "order": len(bank) + 1,
            "questionText": (
                f"How do you address enterprise operational constraints—such as security audits, compliance, "
                f"and zero-downtime deployments—across the applications you developed?"
            ),
            "category": "DATABASE_AND_APIS",
            "groundingSource": f"resume:skills:enterprise_readiness",
            "projectId": None
        })

    # Sequential order numbering
    for idx, item in enumerate(bank):
        item["order"] = idx + 1

    return bank


async def generate_interview_question_bank(
    candidate_context: Dict[str, Any],
    style_id: str,
    previous_interviews_questions: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Generates a fresh, interview-specific question bank (8-12 questions) tailored to the candidate's
    actual resume, specific projects, and selected company style preset.
    Uses OpenAI GPT-4o if available, with automatic fallback to deterministic generator.
    """
    api_key = settings.OPENAI_API_KEY
    style_config = get_style_config(style_id)
    cand = candidate_context.get("candidate", {})
    candidate_name = cand.get("name", "Candidate")
    projects = candidate_context.get("projects", [])

    if api_key and len(projects) > 0:
        try:
            client = openai.OpenAI(api_key=api_key)
            proj_summary = []
            for p in projects:
                proj_summary.append(
                    f"- Project: '{p.get('name')}' (Context Source: {p.get('contextSource')})\n"
                    f"  Description: {p.get('resumeDescription', '')[:300]}\n"
                    f"  Technologies: {', '.join(p.get('technologies', []))}\n"
                    f"  GitHub: {p.get('githubUrl') or 'N/A'}"
                )
            projects_text = "\n".join(proj_summary)

            avoid_text = ""
            if previous_interviews_questions:
                avoid_text = f"\nQUESTIONS ALREADY ASKED IN PAST INTERVIEWS FOR THIS CANDIDATE (DO NOT REPEAT):\n" + "\n".join(
                    [f"- {q}" for q in previous_interviews_questions[:10]]
                )

            prompt = f"""
You are the Lead Technical Interview Architect for IntervAI.
Generate a fresh question bank of 8 to 12 technically rigorous, deeply grounded interview questions for candidate "{candidate_name}".

COMPANY STYLE PRESET: {style_config.name} ({', '.join(style_config.companies)})
PROBING EMPHASIS: {style_config.probingEmphasis}

CANDIDATE PROJECTS:
{projects_text}

CANDIDATE SKILLS: {', '.join(cand.get('skills', []))}
{avoid_text}

RULES:
1. Every question MUST be grounded in the candidate's actual projects or claimed skills.
2. Reference their real project names directly (e.g. '{projects[0].get('name')}'). NEVER use 'Primary Technical Project'.
3. Question 1 MUST be a personalized, compelling technical opening question diving into their primary project (no generic greeting or fluff).
4. Questions 2-12 must explore implementation mechanics, architecture, failure scenarios, edge cases, complexity, and database/API design according to the {style_config.name} preset.
5. Ensure questions are distinct and probe different technical dimensions.
6. Generate between 8 and 12 questions.
"""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "question_bank",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "questions": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "order": {"type": "integer"},
                                            "questionText": {"type": "string"},
                                            "category": {"type": "string"},
                                            "groundingSource": {"type": "string"},
                                        },
                                        "required": ["order", "questionText", "category", "groundingSource"],
                                        "additionalProperties": False,
                                    },
                                },
                            },
                            "required": ["questions"],
                            "additionalProperties": False,
                        },
                    },
                },
            )

            content = response.choices[0].message.content
            if content:
                data = json.loads(content)
                q_list = data.get("questions", [])
                if len(q_list) >= 6:
                    # Clean and validate
                    clean_bank = []
                    for idx, q in enumerate(q_list):
                        clean_bank.append({
                            "order": idx + 1,
                            "questionText": q["questionText"].strip(),
                            "category": q.get("category", "technical"),
                            "groundingSource": q.get("groundingSource", f"project:{projects[0].get('name')}"),
                            "projectId": projects[0].get("id") if projects else None
                        })
                    return clean_bank
        except Exception as e:
            logger.warning(f"OpenAI question bank generation notice, falling back to deterministic bank: {e}")

    return generate_deterministic_question_bank(candidate_context, style_id)


def store_planned_questions(
    db: Session,
    interview_id: str,
    questions: List[Dict[str, Any]]
) -> List[InterviewPlannedQuestion]:
    """Persists newly generated questions to the temporary InterviewPlannedQuestion table."""
    planned_records = []
    for q in questions:
        record = InterviewPlannedQuestion(
            interviewId=interview_id,
            order=q["order"],
            questionText=q["questionText"],
            category=q.get("category", "general"),
            groundingSource=q.get("groundingSource", "resume:general"),
            projectId=q.get("projectId"),
            isAsked=False
        )
        db.add(record)
        planned_records.append(record)
    db.commit()
    return planned_records


def get_next_question_from_bank(
    db: Session,
    interview_id: str,
    candidate_answer: Optional[str] = None
) -> Tuple[Optional[str], int, str]:
    """
    Selects the next unasked question from the interview's planned question bank.
    Runs anti-repetition detection against all previously asked questions.
    Returns (questionText, order, groundingSource).
    """
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        return None, 1, "resume:general"

    # 1. Fetch all questions already asked in this interview
    asked_records = (
        db.query(InterviewQuestion)
        .filter(InterviewQuestion.interviewId == interview_id)
        .order_by(InterviewQuestion.order)
        .all()
    )
    asked_texts = [q.questionText for q in asked_records]
    next_order = len(asked_records) + 1

    candidate_context = {}
    try:
        candidate_context = json.loads(interview.candidateContext)
    except Exception:
        pass

    # 2. Fetch unasked planned questions
    unasked_questions = (
        db.query(InterviewPlannedQuestion)
        .filter(
            InterviewPlannedQuestion.interviewId == interview_id,
            InterviewPlannedQuestion.isAsked == False
        )
        .order_by(InterviewPlannedQuestion.order)
        .all()
    )

    for planned_q in unasked_questions:
        is_dup, reason = is_duplicate_or_repetitive(
            planned_q.questionText,
            asked_texts,
            candidate_context
        )
        if not is_dup:
            planned_q.isAsked = True
            db.commit()
            return planned_q.questionText, next_order, planned_q.groundingSource
        else:
            logger.info(f"Anti-repetition skipped planned question: {reason}")
            planned_q.isAsked = True  # Discard repetitive question

    # Fallback if planned bank is exhausted: synthesize a fresh non-repetitive question
    projects = candidate_context.get("projects", [])
    primary_project = projects[0].get("name", "your engineering project") if projects else "your project"

    candidate_skills = candidate_context.get("candidate", {}).get("skills", ["Python", "FastAPI"])
    skill = candidate_skills[next_order % len(candidate_skills)] if candidate_skills else "system engineering"

    fallback_q = f"Looking at your work on {primary_project}, how did you ensure reliability and testability when integrating {skill}?"
    is_dup, _ = is_duplicate_or_repetitive(fallback_q, asked_texts, candidate_context)
    if is_dup:
        fallback_q = f"How would you optimize the maintainability, observability, and scaling of the architectures you built for {primary_project}?"

    return fallback_q, next_order, f"project:{primary_project}:reliability"


def cleanup_temporary_question_bank(db: Session, interview_id: str) -> int:
    """
    Deletes all temporary planned questions for an interview after results are ready.
    Preserves all permanent InterviewQuestion and InterviewAnswer records.
    Returns the count of deleted planned questions.
    """
    deleted_count = (
        db.query(InterviewPlannedQuestion)
        .filter(InterviewPlannedQuestion.interviewId == interview_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info(f"Cleaned up {deleted_count} temporary planned questions for interview {interview_id}")
    return deleted_count
