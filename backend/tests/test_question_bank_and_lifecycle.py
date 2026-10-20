import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import (
    User,
    Resume,
    Interview,
    InterviewQuestion,
    InterviewAnswer,
    InterviewPlannedQuestion,
    Evaluation,
)
from backend.app.services.question_bank import (
    is_duplicate_or_repetitive,
    generate_deterministic_question_bank,
    get_next_question_from_bank,
    cleanup_temporary_question_bank,
)

client = TestClient(app)


def test_anti_repetition_exact_and_semantic():
    asked = [
        "What was the reason for choosing ChromaDB for your fake news detection system?"
    ]
    candidate_context = {
        "projects": [
            {
                "name": "Fake News Detection System",
                "technologies": ["ChromaDB", "Python", "FastAPI"],
            }
        ]
    }

    # 1. Exact match
    is_dup1, _ = is_duplicate_or_repetitive(
        "what was the reason for choosing chromadb for your fake news detection system",
        asked,
        candidate_context,
    )
    assert is_dup1 is True

    # 2. Semantic rephrased duplicates (same intent: CHOICE_OR_SELECTION on ChromaDB)
    is_dup2, _ = is_duplicate_or_repetitive(
        "Why did you select ChromaDB?", asked, candidate_context
    )
    assert is_dup2 is True

    is_dup3, _ = is_duplicate_or_repetitive(
        "Why did you decide to use ChromaDB?", asked, candidate_context
    )
    assert is_dup3 is True

    # 3. Valid follow-up exploring failure scenarios (different intent)
    is_dup4, _ = is_duplicate_or_repetitive(
        "In a production failure scenario with upstream timeouts, how does ChromaDB handle query retries?",
        asked,
        candidate_context,
    )
    assert is_dup4 is False

    # 4. Valid question on a different project/aspect
    is_dup5, _ = is_duplicate_or_repetitive(
        "How did you analyze the algorithmic time complexity of token chunking in your pipeline?",
        asked,
        candidate_context,
    )
    assert is_dup5 is False


def test_deterministic_question_bank_generation_depth_and_styles():
    context = {
        "candidate": {
            "name": "Jane Developer",
            "skills": ["Python", "FastAPI", "PyTorch", "ChromaDB"],
            "technologies": ["PostgreSQL", "Docker"],
        },
        "projects": [
            {
                "id": "proj-1",
                "name": "NutrInspect – AI-Powered Nutrition Analysis",
                "resumeDescription": "Computer vision and food tracking pipeline.",
                "technologies": ["PyTorch", "FastAPI"],
                "contextSource": "resume+github_readme",
            },
            {
                "id": "proj-2",
                "name": "AI Agent for Fake News Detection",
                "resumeDescription": "Multi-agent RAG verification system.",
                "technologies": ["ChromaDB", "LangChain"],
                "contextSource": "resume_only",
            },
        ],
    }

    # FAANG: Algorithms, complexity, edge cases
    faang_bank = generate_deterministic_question_bank(context, "FAANG")
    assert len(faang_bank) >= 7
    assert "NutrInspect" in faang_bank[0]["questionText"]
    assert any("complexity" in q["questionText"].lower() for q in faang_bank)
    assert any("edge cases" in q["questionText"].lower() for q in faang_bank)

    # MANGOS: Architecture, trade-offs, failure modes
    mangos_bank = generate_deterministic_question_bank(context, "MANGOS")
    assert len(mangos_bank) >= 7
    assert any("architecture" in q["questionText"].lower() for q in mangos_bank)
    assert any("failure" in q["questionText"].lower() for q in mangos_bank)

    # BIG_4: Database schemas, APIs, debugging
    big4_bank = generate_deterministic_question_bank(context, "BIG_4")
    assert len(big4_bank) >= 7
    assert any("database" in q["questionText"].lower() for q in big4_bank)
    assert any("logging" in q["questionText"].lower() or "debugging" in q["questionText"].lower() for q in big4_bank)


def test_independent_question_banks_between_interviews():
    # Setup test resume in DB
    db = SessionLocal()
    user = User()
    db.add(user)
    db.flush()

    profile_dict = {
        "name": "Alex Candidate",
        "skills": ["Python"],
        "projects": [
            {
                "name": "NutrInspect – AI-Powered Nutrition Analysis",
                "description": "Vision app",
                "technologies": ["Python"],
            }
        ],
    }

    resume = Resume(
        userId=user.id,
        fileName="alex_resume.pdf",
        rawText="Alex Candidate Resume",
        parsedProfile=json.dumps(profile_dict),
    )
    db.add(resume)
    db.commit()

    # Interview 1 (FAANG)
    res1 = client.post("/api/interview/start", json={"resumeId": resume.id, "style": "FAANG"})
    assert res1.status_code == 200
    inv1_id = res1.json()["interviewId"]

    # Interview 2 (MANGOS)
    res2 = client.post("/api/interview/start", json={"resumeId": resume.id, "style": "MANGOS"})
    assert res2.status_code == 200
    inv2_id = res2.json()["interviewId"]

    assert inv1_id != inv2_id

    # Check planned questions in DB
    q_inv1 = db.query(InterviewPlannedQuestion).filter(InterviewPlannedQuestion.interviewId == inv1_id).all()
    q_inv2 = db.query(InterviewPlannedQuestion).filter(InterviewPlannedQuestion.interviewId == inv2_id).all()

    assert len(q_inv1) >= 6
    assert len(q_inv2) >= 6
    assert set(q.id for q in q_inv1).isdisjoint(set(q.id for q in q_inv2)), "Interviews must have distinct planned questions"

    db.close()


def test_question_bank_lifecycle_and_cleanup_after_results():
    db = SessionLocal()
    user = User()
    db.add(user)
    db.flush()

    profile_dict = {
        "name": "Sam Engineer",
        "skills": ["Python", "FastAPI"],
        "projects": [
            {
                "name": "NutrInspect – AI-Powered Nutrition Analysis",
                "description": "Nutrition analysis vision pipeline",
                "technologies": ["PyTorch", "FastAPI"],
            },
            {
                "name": "Agentic AI Based Pharmacy System",
                "description": "Prescription processing",
                "technologies": ["LangChain"],
            },
        ],
    }

    resume = Resume(
        userId=user.id,
        fileName="sam_resume.pdf",
        rawText="Sam Engineer Resume",
        parsedProfile=json.dumps(profile_dict),
    )
    db.add(resume)
    db.commit()

    # 1. Start Interview -> Generates fresh question bank
    start_res = client.post("/api/interview/start", json={"resumeId": resume.id, "style": "FAANG"})
    inv_id = start_res.json()["interviewId"]

    # Verify planned questions exist before session
    initial_planned = db.query(InterviewPlannedQuestion).filter(InterviewPlannedQuestion.interviewId == inv_id).all()
    assert len(initial_planned) >= 6, "Planned questions should be populated"

    # 2. Session creation -> retrieves opening question
    session_res = client.post("/api/interview/session", json={"interviewId": inv_id})
    session_data = session_res.json()
    assert session_data["success"] is True
    assert "openingQuestion" in session_data
    assert "NutrInspect" in session_data["openingQuestion"]

    # 3. Save Answer -> dynamically returns next grounded question
    ans_res = client.post("/api/interview/answer", json={
        "interviewId": inv_id,
        "order": 1,
        "questionText": session_data["openingQuestion"],
        "groundingSource": session_data.get("openingSource", "project:NutrInspect"),
        "transcript": "We used PyTorch with a custom ResNet backbone running at 45 FPS on edge devices."
    })
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert "nextQuestion" in ans_data
    assert len(ans_data["nextQuestion"]) > 10

    # 4. End Interview -> generates evaluation, but preserves question bank until results loaded
    end_res = client.post("/api/interview/end", json={"interviewId": inv_id})
    assert end_res.status_code == 200

    # Verify planned questions still present before results loaded
    pre_results_planned = db.query(InterviewPlannedQuestion).filter(InterviewPlannedQuestion.interviewId == inv_id).all()
    assert len(pre_results_planned) > 0, "Question bank must remain available until results are requested"

    # 5. Get Results -> Deliver report and delete temporary question bank
    results_res = client.get(f"/api/interview/{inv_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data["success"] is True
    assert len(results_data["transcript"]) >= 1
    assert results_data["evaluation"] is not None

    # Verify temporary question bank was purged
    post_results_planned = db.query(InterviewPlannedQuestion).filter(InterviewPlannedQuestion.interviewId == inv_id).all()
    assert len(post_results_planned) == 0, "Temporary planned questions must be deleted after results delivery"

    # 6. Verify permanent interview history is preserved
    permanent_questions = db.query(InterviewQuestion).filter(InterviewQuestion.interviewId == inv_id).all()
    assert len(permanent_questions) >= 1, "Asked questions must remain stored permanently"
    permanent_answers = db.query(InterviewAnswer).filter(InterviewAnswer.interviewId == inv_id).all()
    assert len(permanent_answers) >= 1, "Candidate answers must remain stored permanently"

    # 7. Verify Results Page can be refreshed/reopened safely (idempotent cleanup)
    refreshed_res = client.get(f"/api/interview/{inv_id}/results")
    assert refreshed_res.status_code == 200
    refreshed_data = refreshed_res.json()
    assert refreshed_data["success"] is True
    assert len(refreshed_data["transcript"]) == len(results_data["transcript"])
    assert refreshed_data["evaluation"]["overallScore"] == results_data["evaluation"]["overallScore"]

    # 8. Verify standalone cleanup endpoint idempotency
    cleanup_res = client.post(f"/api/interview/{inv_id}/cleanup")
    assert cleanup_res.status_code == 200
    assert cleanup_res.json()["deletedPlannedQuestions"] == 0

    db.close()
