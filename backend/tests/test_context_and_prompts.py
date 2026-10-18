import pytest
from backend.app.services.resume_parser import CandidateProfile, EducationItem, ExperienceItem, ProjectItem
from backend.app.services.candidate_context_builder import build_candidate_context
from backend.app.services.system_prompt import build_interviewer_system_prompt
from backend.app.config.interview_styles import INTERVIEW_STYLES, get_style_config


@pytest.mark.asyncio
async def test_candidate_context_builder():
    profile = CandidateProfile(
        name="Jane Doe",
        skills=["Python", "PyTorch", "ChromaDB", "Next.js"],
        technologies=["Python", "ChromaDB"],
        education=[EducationItem(degree="B.S. Computer Science", institution="Tech Univ")],
        experience=[ExperienceItem(role="AI Intern", company="Tech Corp", description="Developed RAG retrieval system")],
        projects=[
            ProjectItem(
                name="Fake News Detection System",
                description="Built a RAG-based fake-news detection system using ChromaDB.",
                url="https://github.com/janedoe/fake-news-rag"
            ),
            ProjectItem(
                name="React Dashboard App",
                description="Built frontend supply chain tracking app in React.",
                url=None
            )
        ]
    )

    context = await build_candidate_context(profile)
    assert context.candidate.name == "Jane Doe"
    assert len(context.projects) == 2
    assert context.projects[1].contextSource == "resume_only"


@pytest.mark.asyncio
async def test_system_prompt_grounding_and_styles():
    profile = CandidateProfile(
        name="Jane Doe",
        skills=["Python", "PyTorch", "ChromaDB", "Next.js"],
        technologies=["Python", "ChromaDB"],
        education=[EducationItem(degree="B.S. Computer Science", institution="Tech Univ")],
        experience=[ExperienceItem(role="AI Intern", company="Tech Corp", description="Developed RAG retrieval system")],
        projects=[
            ProjectItem(
                name="Fake News Detection System",
                description="Built a RAG-based fake-news detection system using ChromaDB.",
                url="https://github.com/janedoe/fake-news-rag"
            )
        ]
    )
    context = await build_candidate_context(profile)

    # 1. Base Grounding Guardrails
    default_prompt = build_interviewer_system_prompt(context)
    assert "CRITICAL GROUNDING RULES" in default_prompt
    assert "Fake News Detection System" in default_prompt
    assert "ChromaDB" in default_prompt
    assert "DO NOT ASK UNGROUNDED GENERIC CS TRIVIA" in default_prompt
    assert "DO NOT ASK HR, BEHAVIORAL, OR NON-TECHNICAL QUESTIONS" in default_prompt

    # 2. FAANG Style Directives
    faang_prompt = build_interviewer_system_prompt(context, "FAANG")
    assert "STYLE PRESET: FAANG" in faang_prompt
    assert "Meta, Amazon, Apple, Netflix, Google" in faang_prompt
    assert "Technical Depth, Algorithms, Complexity" in faang_prompt

    # 3. MANGOS Style Directives
    mangos_prompt = build_interviewer_system_prompt(context, "MANGOS")
    assert "STYLE PRESET: MANGOS" in mangos_prompt
    assert "Meta, Anthropic, NVIDIA, Google, OpenAI, SpaceX" in mangos_prompt
    assert "Architectural Reasoning, AI/ML & Systems Concepts" in mangos_prompt

    # 4. BIG 4 Style Directives
    big4_prompt = build_interviewer_system_prompt(context, "BIG_4")
    assert "STYLE PRESET: BIG 4" in big4_prompt
    assert "Deloitte, PwC, EY, KPMG" in big4_prompt
    assert "Practical Software Engineering, Databases, APIs, Debugging" in big4_prompt

    # 5. Probing Differentiation
    assert faang_prompt != mangos_prompt
    assert mangos_prompt != big4_prompt
    assert faang_prompt != big4_prompt
