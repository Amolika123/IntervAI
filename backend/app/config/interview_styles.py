from typing import Dict, List, Literal
from pydantic import BaseModel

InterviewStyleId = Literal["FAANG", "MANGOS", "BIG_4"]


class InterviewStyleConfig(BaseModel):
    id: str
    name: str
    badge: str
    companies: List[str]
    tagline: str
    description: str
    focusAreas: List[str]
    probingEmphasis: str
    exampleProbing: str
    color: str


INTERVIEW_STYLES: Dict[str, InterviewStyleConfig] = {
    "FAANG": InterviewStyleConfig(
        id="FAANG",
        name="FAANG",
        badge="Algorithms & Depth",
        companies=["Meta", "Amazon", "Apple", "Netflix", "Google"],
        tagline="Technical depth, algorithmic complexity, implementation choices & edge cases",
        description=(
            "Emphasizes rigorous technical problem-solving, computational complexity, "
            "memory and runtime efficiency, low-level implementation decisions, and boundary "
            "edge cases tied to your projects and claimed skills."
        ),
        focusAreas=[
            "Implementation depth & mechanics",
            "Time & space complexity trade-offs",
            "Edge cases & boundary input handling",
            "Data structures & vector index selection",
            "Optimization & bottleneck identification",
        ],
        probingEmphasis=(
            "Probe deeply into the mechanics of the code, data structure choices, algorithmic "
            "efficiency, complexity analysis (Big-O where relevant), boundary edge cases, and runtime "
            "optimizations strictly tied to the candidate's stated resume projects."
        ),
        exampleProbing=(
            "How does retrieval or processing latency scale with input size? What edge cases arise "
            "with malformed inputs? Why choose this specific data structure or vector indexing method?"
        ),
        color="#06b6d4",
    ),
    "MANGOS": InterviewStyleConfig(
        id="MANGOS",
        name="MANGOS",
        badge="Frontier AI & Systems",
        companies=["Meta", "Anthropic", "NVIDIA", "Google", "OpenAI", "SpaceX"],
        tagline="Architectural reasoning, AI/ML concepts, failure scenarios & system trade-offs",
        description=(
            "Emphasizes deep technical reasoning, distributed/cloud and AI/ML architectures, "
            "evaluation metrics, hardware/compute trade-offs, failure modes, and first-principles "
            "design choices evidenced in your projects."
        ),
        focusAreas=[
            "First-principles design reasoning",
            "AI/ML & systems architecture",
            "Failure modes & fault recovery",
            "Model, compute & memory trade-offs",
            "Scalability under heavy distributed load",
        ],
        probingEmphasis=(
            "Probe deeply into architectural decisions, alternative architectures considered and discarded, "
            "model or system trade-offs, failure modes (e.g. timeouts, hallucinations, corrupted embeddings), "
            "and first-principles reasoning from their project documentation."
        ),
        exampleProbing=(
            "Why choose this pipeline architecture over alternatives? How does the system handle "
            "degraded upstream dependencies? How do compute, memory, and latency trade-offs impact "
            "this architecture at scale?"
        ),
        color="#8b5cf6",
    ),
    "BIG_4": InterviewStyleConfig(
        id="BIG_4",
        name="Big 4",
        badge="Enterprise Engineering & Rigor",
        companies=["Deloitte", "PwC", "EY", "KPMG"],
        tagline="Practical software engineering, databases, APIs, debugging & reliability",
        description=(
            "Emphasizes practical software engineering, enterprise integration, database schemas, "
            "API contracts, debugging strategies, security/integrity considerations, and real-world "
            "operational constraints."
        ),
        focusAreas=[
            "Practical software engineering & maintainability",
            "Database modeling & query integrity",
            "API contracts & error handling standards",
            "Debugging, logging & observability",
            "Enterprise reliability & business constraints",
        ],
        probingEmphasis=(
            "Probe deeply into practical software engineering choices, API design, database schemas, "
            "data consistency, maintainability, debugging workflows, and operational reliability based "
            "on the candidate's resume claims."
        ),
        exampleProbing=(
            "How did you structure your database schemas and query indexing for reliability? How do your "
            "APIs handle validation and error propagation? What logging and debugging steps do you take "
            "when errors occur in production?"
        ),
        color="#10b981",
    ),
}


def get_style_config(style_id: str) -> InterviewStyleConfig:
    key = style_id.upper() if style_id else "FAANG"
    if key not in INTERVIEW_STYLES:
        key = "FAANG"
    return INTERVIEW_STYLES[key]
