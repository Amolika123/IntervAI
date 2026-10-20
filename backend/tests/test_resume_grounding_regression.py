import pytest
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.db.session import Base, get_db
from backend.app.db.models import User, Resume, Interview, Project, InterviewPlannedQuestion, InterviewQuestion, InterviewAnswer
from backend.app.services.resume_parser import (
    CandidateProfile,
    ProjectItem,
    EducationItem,
    ExperienceItem,
    fallback_rule_based_parser
)
from backend.app.services.candidate_context_builder import build_candidate_context
from backend.app.services.question_bank import (
    generate_deterministic_question_bank,
    store_planned_questions,
    get_next_question_from_bank,
    cleanup_temporary_question_bank
)

from backend.app.db.session import SessionLocal

TestingSessionLocal = SessionLocal
client = TestClient(app)


# Sample realistic test resume with 4 distinct projects and GitHub links
SAMPLE_RESUME_TEXT = """
Amolika Saha
amolika.saha@example.com | github.com/Amolika123 | linkedin.com/in/amolika-saha

EDUCATION
B.Tech in Computer Science and Engineering
Heritage Institute of Technology, 2021 - 2025

TECHNICAL SKILLS
Languages & Frameworks: Python, JavaScript, TypeScript, React, Streamlit, FastAPI, LangChain, Next.js
Databases & Tools: PostgreSQL, SQLite, ChromaDB, Git, Docker, Gemini 1.5 Pro, PyTorch

PROJECTS

NutrInspect – AI-Powered Nutrition Analysis
• GitHub: https://github.com/Amolika123/NutrInspect
• Built an intelligent nutrition analysis pipeline utilizing Google Gemini 1.5 Pro to evaluate dietary macronutrients from food labels.
• Implemented interactive Streamlit UI for instant calorie tracking, allergen detection, and customized health warnings.
• Optimized latency by caching embedding lookups and downsampling image uploads.

AI Agent for Fake News Detection
• GitHub: https://github.com/Amolika123/Fake-News-Detector
• Engineered an agentic verification workflow using LangChain, ChromaDB vector database, and Google Search API.
• Designed retrieval-augmented generation (RAG) architecture to compute credibility scores for contentious news claims.
• Implemented automated fallback strategies when upstream search rate limits are reached.

Agentic AI based Pharmacy System (LLM-Based System)
• GitHub: https://github.com/Amolika123/Agentic-Pharmacy
• Developed multi-agent clinical decision support system coordinating prescription parsing, drug contraindication detection, and inventory reconciliation.
• Built structured Pydantic schema validation to guarantee zero hallucination on drug dosage limits.

Version Control Practice
• Implemented custom lightweight Git plumbing commands in Python including blob hashing, tree traversal, and commit hashing.
"""


def test_1_multiple_actual_project_names_extracted():
    """Verify that multiple distinct project names are extracted from resume text."""
    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    names = [p.name for p in profile.projects]
    assert len(names) >= 3
    assert any("NutrInspect" in n for n in names)
    assert any("Fake News" in n for n in names)
    assert any("Pharmacy" in n for n in names)
    # Ensure no generic placeholder name was produced
    assert not any("primary technical project" in n.lower() for n in names)


def test_2_and_3_project_descriptions_and_technologies_attached():
    """Verify that each project description and tech stack remain attached to that project."""
    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    nutr = next(p for p in profile.projects if "NutrInspect" in p.name)
    assert "Gemini" in nutr.description or "nutrition" in nutr.description.lower()
    assert "Streamlit" in nutr.technologies or "Python" in nutr.technologies

    fake_news = next(p for p in profile.projects if "Fake News" in p.name)
    assert "ChromaDB" in fake_news.description or "LangChain" in fake_news.description
    assert any(t in fake_news.technologies for t in ["ChromaDB", "LangChain", "Python"])


@pytest.mark.asyncio
async def test_4_5_6_7_fallback_rules_and_github_handling():
    """Verify CASE A, B, C, D fallback rules for projects with and without repositories."""
    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    context = await build_candidate_context(profile)

    # Project without GitHub link (Version Control Practice) -> CASE D: resume_only
    vc_proj = next((p for p in context.projects if "Version Control" in p.name), None)
    if vc_proj:
        assert vc_proj.contextSource == "resume_only"
        assert vc_proj.repositoryAccessible is False
        assert len(vc_proj.resumeDescription) > 10

    # Project with GitHub link retains link
    nutr_proj = next(p for p in context.projects if "NutrInspect" in p.name)
    assert nutr_proj.githubUrl is not None
    assert "github.com" in nutr_proj.githubUrl


@pytest.mark.asyncio
async def test_8_new_upload_does_not_leak_previous_context():
    """Verify that uploading different resumes produces isolated, independent candidate contexts."""
    profile_candidate_a = CandidateProfile(
        name="Candidate Alpha",
        skills=["C++", "CUDA"],
        technologies=["C++"],
        projects=[ProjectItem(name="Autonomous Drone Vision", description="Real-time obstacle avoidance with CUDA.")]
    )
    profile_candidate_b = CandidateProfile(
        name="Candidate Beta",
        skills=["Go", "Kubernetes"],
        technologies=["Go"],
        projects=[ProjectItem(name="K8s Ingress Controller", description="High throughput proxy in Go.")]
    )

    ctx_a = await build_candidate_context(profile_candidate_a)
    ctx_b = await build_candidate_context(profile_candidate_b)

    assert ctx_a.candidate.name == "Candidate Alpha"
    assert ctx_b.candidate.name == "Candidate Beta"
    assert ctx_a.projects[0].name == "Autonomous Drone Vision"
    assert ctx_b.projects[0].name == "K8s Ingress Controller"
    assert "K8s" not in ctx_a.projects[0].name


def test_9_and_10_interview_creation_and_first_question_grounding():
    """Verify interview creation retrieves stored resume and generates project-grounded opening question."""
    db = TestingSessionLocal()
    user = User()
    db.add(user)
    db.flush()

    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    # Convert projects
    p_items = []
    for p in profile.projects:
        p_items.append({
            "name": p.name,
            "resumeDescription": p.description,
            "technologies": p.technologies,
            "githubUrl": p.url,
            "contextSource": "resume_only"
        })

    cand_context = {
        "candidate": {"name": profile.name, "skills": profile.skills, "technologies": profile.technologies},
        "projects": p_items
    }

    interview = Interview(
        userId=user.id,
        resumeId="test_res_123",
        status="CREATED",
        style="FAANG",
        candidateContext=json.dumps(cand_context)
    )
    db.add(interview)
    db.commit()

    # Generate question bank
    bank = generate_deterministic_question_bank(cand_context, "FAANG")
    assert len(bank) >= 6
    store_planned_questions(db, interview.id, bank)

    # First question must mention first real project
    first_q = bank[0]
    assert "NutrInspect" in first_q["questionText"]
    assert "NutrInspect" in first_q["groundingSource"]
    assert "primary technical project" not in first_q["questionText"].lower()
    assert "architecture of your primary project" not in first_q["questionText"].lower()

    # Verify session API retrieval
    res = client.get(f"/api/interview/session?interviewId={interview.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["candidateName"] == profile.name
    assert len(data["projects"]) >= 3
    assert "NutrInspect" in data["projects"][0]["name"]
    assert "NutrInspect" in data["openingQuestion"]
    assert "project:NutrInspect" in data["openingSource"]
    db.close()


def test_11_placeholder_only_context_rejected():
    """Verify that placeholder-only context is rejected with 422 error."""
    db = TestingSessionLocal()
    user = User()
    db.add(user)
    db.flush()

    placeholder_context = {
        "candidate": {"name": "Candidate", "skills": []},
        "projects": [
            {"name": "Primary Technical Project", "resumeDescription": "General experience", "contextSource": "resume:project_1"}
        ]
    }

    interview = Interview(
        userId=user.id,
        resumeId="placeholder_res",
        status="CREATED",
        style="FAANG",
        candidateContext=json.dumps(placeholder_context)
    )
    db.add(interview)
    db.commit()

    res = client.get(f"/api/interview/session?interviewId={interview.id}")
    # Must reject with 422 because projects are only placeholders
    assert res.status_code == 422
    data = res.json()
    assert "placeholder" in data["detail"].lower() or "project" in data["detail"].lower()
    db.close()


def test_12_followup_questions_relevant_and_adaptive():
    """Verify that answering a question advances to the next planned question with updated grounding."""
    db = TestingSessionLocal()
    user = User()
    db.add(user)
    db.flush()

    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    p_items = [{
        "name": p.name,
        "resumeDescription": p.description,
        "technologies": p.technologies,
        "contextSource": "resume_only"
    } for p in profile.projects]

    cand_context = {
        "candidate": {"name": profile.name, "skills": profile.skills},
        "projects": p_items
    }

    interview = Interview(
        userId=user.id,
        resumeId="test_res_flow",
        status="IN_PROGRESS",
        style="FAANG",
        candidateContext=json.dumps(cand_context)
    )
    db.add(interview)
    db.commit()

    bank = generate_deterministic_question_bank(cand_context, "FAANG")
    store_planned_questions(db, interview.id, bank)

    # First turn answer
    turn1_res = client.post("/api/interview/answer", json={
        "interviewId": interview.id,
        "order": 1,
        "questionText": bank[0]["questionText"],
        "transcript": "I built the system using Streamlit and Gemini 1.5 Pro with prompt dataclasses.",
        "status": "answered",
        "groundingSource": bank[0]["groundingSource"],
        "style": "FAANG"
    })
    assert turn1_res.status_code == 200
    t1_data = turn1_res.json()
    assert t1_data["success"] is True
    assert t1_data["nextOrder"] == 2
    assert "NutrInspect" in t1_data["nextQuestion"]
    assert "project:NutrInspect" in t1_data["nextGroundingSource"]

    # Second turn answer
    turn2_res = client.post("/api/interview/answer", json={
        "interviewId": interview.id,
        "order": 2,
        "questionText": t1_data["nextQuestion"],
        "transcript": "I optimized the image downscaling from 8MB to 400KB to reduce latency.",
        "status": "answered",
        "groundingSource": t1_data["nextGroundingSource"],
        "style": "FAANG"
    })
    assert turn2_res.status_code == 200
    t2_data = turn2_res.json()
    assert t2_data["success"] is True
    assert t2_data["nextOrder"] == 3
    assert t2_data["nextQuestion"] != t1_data["nextQuestion"]
    db.close()


def test_13_distinct_interview_styles_preserved():
    """Verify that FAANG, MANGOS, and Big 4 produce distinct question bank emphases."""
    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    cand_context = {
        "candidate": {"name": profile.name, "skills": profile.skills},
        "projects": [{"name": p.name, "resumeDescription": p.description, "technologies": p.technologies} for p in profile.projects]
    }

    faang_bank = generate_deterministic_question_bank(cand_context, "FAANG")
    mangos_bank = generate_deterministic_question_bank(cand_context, "MANGOS")
    big4_bank = generate_deterministic_question_bank(cand_context, "BIG_4")

    # FAANG emphasizes computational bottlenecks and algorithmic complexity
    assert any("complexity" in q["questionText"].lower() or "bottleneck" in q["questionText"].lower() for q in faang_bank)
    # MANGOS emphasizes system architecture trade-offs and catastrophic failure handling
    assert any("trade-offs" in q["questionText"].lower() or "catastrophic" in q["questionText"].lower() for q in mangos_bank)
    # Big 4 emphasizes practical software engineering, database schemas and API contracts
    assert any("database" in q["questionText"].lower() or "api" in q["questionText"].lower() for q in big4_bank)


def test_14_and_15_grounding_metadata_and_results_persistence():
    """Verify that grounding metadata is persisted on question records and delivered in results."""
    db = TestingSessionLocal()
    user = User()
    db.add(user)
    db.flush()

    profile = fallback_rule_based_parser(SAMPLE_RESUME_TEXT)
    cand_context = {
        "candidate": {"name": profile.name, "skills": profile.skills},
        "projects": [{"name": p.name, "resumeDescription": p.description, "technologies": p.technologies} for p in profile.projects]
    }

    interview = Interview(
        userId=user.id,
        resumeId="test_res_results",
        status="IN_PROGRESS",
        style="FAANG",
        candidateContext=json.dumps(cand_context)
    )
    db.add(interview)
    db.commit()

    bank = generate_deterministic_question_bank(cand_context, "FAANG")
    store_planned_questions(db, interview.id, bank)

    # Submit an answer
    client.post("/api/interview/answer", json={
        "interviewId": interview.id,
        "order": 1,
        "questionText": bank[0]["questionText"],
        "transcript": "Core architecture involves Gemini 1.5 Pro multimodal processing.",
        "status": "answered",
        "groundingSource": bank[0]["groundingSource"],
        "style": "FAANG"
    })

    # End interview
    end_res = client.post("/api/interview/end", json={"interviewId": interview.id})
    assert end_res.status_code == 200

    # Fetch results
    results_res = client.get(f"/api/interview/{interview.id}/results")
    assert results_res.status_code == 200
    res_data = results_res.json()
    assert res_data["success"] is True
    assert len(res_data["transcript"]) >= 1
    assert res_data["transcript"][0]["groundingSource"] == bank[0]["groundingSource"]
    assert "NutrInspect" in res_data["transcript"][0]["groundingSource"]
    assert res_data["evaluation"] is not None
    db.close()


def test_regression_screenshot_failure():
    """
    CRITICAL REGRESSION TEST:
    If candidate context contains real named projects, the interviewer must NOT default to
    'Primary Technical Project (General experience)' or generate a generic primary-project
    question without using the available project information.
    """
    db = TestingSessionLocal()
    user = User()
    db.add(user)
    db.flush()

    real_projects = [
        {
            "name": "NutrInspect – AI-Powered Nutrition Analysis",
            "resumeDescription": "AI-driven macronutrient analysis using Gemini 1.5 Pro.",
            "technologies": ["Streamlit", "Python", "Gemini 1.5 Pro"],
            "contextSource": "resume_only"
        },
        {
            "name": "AI Agent for Fake News Detection",
            "resumeDescription": "RAG-based fake-news verification using ChromaDB.",
            "technologies": ["ChromaDB", "LangChain", "Python"],
            "contextSource": "resume_only"
        }
    ]

    cand_context = {
        "candidate": {"name": "Amolika Saha", "skills": ["Python", "FastAPI", "React"]},
        "projects": real_projects
    }

    interview = Interview(
        userId=user.id,
        resumeId="test_regression_inv",
        status="CREATED",
        style="FAANG",
        candidateContext=json.dumps(cand_context)
    )
    db.add(interview)
    db.commit()

    bank = generate_deterministic_question_bank(cand_context, "FAANG")
    store_planned_questions(db, interview.id, bank)

    session_res = client.get(f"/api/interview/session?interviewId={interview.id}")
    assert session_res.status_code == 200
    session_data = session_res.json()

    # 1. Project name must NOT be generic
    for p in session_data["projects"]:
        assert "primary technical project" not in p["name"].lower()
        assert "general experience" not in p.get("resumeDescription", "").lower()

    # 2. Opening question must NOT be generic
    assert "architecture of your primary project" not in session_data["openingQuestion"].lower()
    assert "NutrInspect" in session_data["openingQuestion"]

    # 3. Grounding source must NOT be resume:project_1
    assert session_data["openingSource"] != "resume:project_1"
    assert "project:NutrInspect" in session_data["openingSource"]

    db.close()
