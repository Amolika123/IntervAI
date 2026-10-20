import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config.interview_config import (
    TOTAL_INTERVIEW_DURATION_SECONDS,
    PER_QUESTION_DURATION_SECONDS,
    TOTAL_WARNING_5MIN_SECONDS,
    TOTAL_WARNING_1MIN_SECONDS,
    TOTAL_WARNING_10SEC_SECONDS,
    QUESTION_WARNING_15SEC_SECONDS,
    QUESTION_WARNING_5SEC_SECONDS,
    RUBRIC_WEIGHTS,
    STATUS_ANSWERED,
    STATUS_UNANSWERED,
    STATUS_TIMED_OUT,
    STATUS_TRANSCRIPTION_FAILED,
    INSUFFICIENT_EVIDENCE_ASSESSMENT,
)
from backend.app.services.evaluator import (
    is_empty_or_filler_transcript,
    calculate_question_weighted_score,
    evaluate_unanswered_turn,
    fallback_evaluation,
    generate_interview_evaluation,
)
import uuid
from datetime import datetime
from backend.app.db.session import SessionLocal
from backend.app.db.models import User, Resume, Interview, InterviewQuestion, InterviewAnswer, Evaluation


client = TestClient(app)


@pytest.fixture
def sample_interview():
    db = SessionLocal()
    try:
        user = db.query(User).first()
        if not user:
            user = User(id=str(uuid.uuid4()))
            db.add(user)
            db.commit()

        resume = db.query(Resume).filter(Resume.userId == user.id).first()
        if not resume:
            resume = Resume(
                id=str(uuid.uuid4()),
                userId=user.id,
                fileName="sample.pdf",
                rawText="Sample resume",
                parsedProfile=json.dumps({"candidate": {"name": "Test Candidate", "skills": ["Python"]}})
            )
            db.add(resume)
            db.commit()

        interview = Interview(
            id=str(uuid.uuid4()),
            userId=user.id,
            resumeId=resume.id,
            status="IN_PROGRESS",
            candidateContext=json.dumps({
                "candidate": {"name": "Test Candidate", "skills": ["Python", "FastAPI"]},
                "projects": [{"name": "TestProject", "contextSource": "resume_only", "technologies": ["Python", "FastAPI"]}]
            }),
            style="FAANG",
            startedAt=datetime.utcnow()
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)
        yield interview
    finally:
        try:
            # Cleanup any test question or evaluation records for this interview
            db.query(Evaluation).filter(Evaluation.interviewId == interview.id).delete()
            db.query(InterviewAnswer).filter(InterviewAnswer.interviewId == interview.id).delete()
            db.query(InterviewQuestion).filter(InterviewQuestion.interviewId == interview.id).delete()
            db.delete(interview)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Test Suite 1: Timing & Centralized Configuration
# ---------------------------------------------------------------------------

def test_centralized_timing_constants():
    """Verify central configuration defines 40min total (2400s), 90s question, and warning thresholds."""
    assert TOTAL_INTERVIEW_DURATION_SECONDS == 2400  # 40 minutes
    assert PER_QUESTION_DURATION_SECONDS == 90       # 90 seconds
    assert TOTAL_WARNING_5MIN_SECONDS == 300         # 5 minutes
    assert TOTAL_WARNING_1MIN_SECONDS == 60          # 1 minute
    assert TOTAL_WARNING_10SEC_SECONDS == 10         # 10 seconds
    assert QUESTION_WARNING_15SEC_SECONDS == 15      # 15 seconds
    assert QUESTION_WARNING_5SEC_SECONDS == 5        # 5 seconds


def test_rubric_weights_sum_to_one():
    """Verify deterministic rubric weights: 40% correctness, 25% completeness, 20% depth, 15% relevance."""
    total_weight = sum(RUBRIC_WEIGHTS.values())
    assert abs(total_weight - 1.0) < 1e-6
    assert RUBRIC_WEIGHTS["technicalCorrectness"] == 0.40
    assert RUBRIC_WEIGHTS["completeness"] == 0.25
    assert RUBRIC_WEIGHTS["depthLevel"] == 0.20
    assert RUBRIC_WEIGHTS["relevance"] == 0.15


# ---------------------------------------------------------------------------
# Test Suite 2: Silence & Filler Detection
# ---------------------------------------------------------------------------

def test_silence_and_filler_detection():
    """Verify that empty strings, whitespace, and filler words are flagged as non-assessable."""
    assert is_empty_or_filler_transcript("") is True
    assert is_empty_or_filler_transcript("   ") is True
    assert is_empty_or_filler_transcript(None) is True
    assert is_empty_or_filler_transcript("um") is True
    assert is_empty_or_filler_transcript("uh... um") is True
    assert is_empty_or_filler_transcript("[silence]") is True
    assert is_empty_or_filler_transcript("hmm like so") is True

    # Valid short answers must NOT be flagged as filler
    assert is_empty_or_filler_transcript("PostgreSQL") is False
    assert is_empty_or_filler_transcript("I used ChromaDB for vector retrieval") is False


# ---------------------------------------------------------------------------
# Test Suite 3: Deterministic Rubric & Score Calculation
# ---------------------------------------------------------------------------

def test_deterministic_question_weighted_score():
    """
    Score formula: (Correctness * 0.40) + (Completeness * 0.25) + (Depth * 0.20) + (Relevance * 0.15)
    """
    # Perfect score
    assert calculate_question_weighted_score(100.0, 100.0, 100.0, 100.0) == 100.0

    # Zero score
    assert calculate_question_weighted_score(0.0, 0.0, 0.0, 0.0) == 0.0

    # Mixed score: 80 * 0.40 (32) + 60 * 0.25 (15) + 70 * 0.20 (14) + 90 * 0.15 (13.5) = 74.5
    score = calculate_question_weighted_score(80.0, 60.0, 70.0, 90.0)
    assert score == 74.5


def test_unanswered_turn_evaluation():
    """Unanswered, timed out, or transcription failed turns must receive 0 for all dimensions."""
    # Unanswered
    unans = evaluate_unanswered_turn(1, "Why ChromaDB?", "project:rag", "", STATUS_UNANSWERED)
    assert unans.questionScore == 0.0
    assert unans.technicalCorrectnessScore == 0.0
    assert unans.completenessScore == 0.0
    assert unans.depthLevelScore == 0.0
    assert unans.relevanceScore == 0.0
    assert "No assessable answer was received" in unans.feedback

    # Timed out
    timed_out = evaluate_unanswered_turn(2, "Explain indexing", "project:rag", "", STATUS_TIMED_OUT)
    assert timed_out.questionScore == 0.0
    assert "Time expired before an answer was provided" in timed_out.feedback

    # Transcription failed
    audio_fail = evaluate_unanswered_turn(3, "Explain RAG", "project:rag", "", STATUS_TRANSCRIPTION_FAILED)
    assert audio_fail.questionScore == 0.0
    assert "audio transcription failure" in audio_fail.feedback


# ---------------------------------------------------------------------------
# Test Suite 4: Evaluation Engine - Zero Inflation Prevention
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_all_answers_empty_returns_zero_score():
    """When all turns are empty, evaluation must return 0 and insufficient evidence assessment."""
    candidate_context = {
        "candidate": {"name": "Alice", "skills": ["Python"]},
        "projects": [{"name": "RAG Project", "technologies": ["ChromaDB"]}]
    }
    turns = [
        {"order": 1, "questionText": "Why ChromaDB?", "groundingSource": "project:RAG", "transcript": "", "status": STATUS_UNANSWERED},
        {"order": 2, "questionText": "What data structures?", "groundingSource": "project:RAG", "transcript": "   ", "status": STATUS_UNANSWERED}
    ]

    result = await generate_interview_evaluation("Alice", candidate_context, turns)
    assert result.overallScore == 0
    assert result.overallAssessment == INSUFFICIENT_EVIDENCE_ASSESSMENT
    for q in result.questionBreakdown:
        assert q.questionScore == 0.0
        assert q.technicalCorrectnessScore == 0.0


@pytest.mark.asyncio
async def test_all_turns_timed_out_returns_zero_score():
    """When all turns time out, evaluation must return 0 and insufficient evidence assessment."""
    candidate_context = {
        "candidate": {"name": "Bob", "skills": ["FastAPI"]},
        "projects": [{"name": "API Gateway", "technologies": ["FastAPI", "Redis"]}]
    }
    turns = [
        {"order": 1, "questionText": "How does routing work?", "groundingSource": "project:API", "transcript": "", "status": STATUS_TIMED_OUT},
        {"order": 2, "questionText": "How do you handle rate limits?", "groundingSource": "project:API", "transcript": "", "status": STATUS_TIMED_OUT}
    ]

    result = await generate_interview_evaluation("Bob", candidate_context, turns)
    assert result.overallScore == 0
    assert result.overallAssessment == INSUFFICIENT_EVIDENCE_ASSESSMENT
    assert len(result.questionBreakdown) == 2
    assert result.questionBreakdown[0].status == STATUS_TIMED_OUT
    assert result.questionBreakdown[1].status == STATUS_TIMED_OUT


@pytest.mark.asyncio
async def test_mixed_answers_deterministic_overall_score():
    """
    Overall score must be the deterministic average across all asked questions,
    including unanswered/timed_out questions as 0/100.
    """
    candidate_context = {
        "candidate": {"name": "Carol", "skills": ["Python", "FastAPI"]},
        "projects": [{"name": "Search Engine", "technologies": ["Python", "Elasticsearch"]}]
    }

    # Turn 1: Detailed answer -> Question score ~80.5
    # Turn 2: Timed out -> Question score 0.0
    turns = [
        {
            "order": 1,
            "questionText": "Explain the search pipeline",
            "groundingSource": "project:Search",
            "transcript": (
                "We indexed documents into Elasticsearch using inverted indices, "
                "with BM25 scoring for lexical retrieval and Python FastAPI for serving queries."
            ),
            "status": STATUS_ANSWERED
        },
        {
            "order": 2,
            "questionText": "What happens if Elasticsearch crashes?",
            "groundingSource": "project:Search",
            "transcript": "",
            "status": STATUS_TIMED_OUT
        }
    ]

    result = await generate_interview_evaluation("Carol", candidate_context, turns)
    q1_score = result.questionBreakdown[0].questionScore
    q2_score = result.questionBreakdown[1].questionScore

    assert q1_score > 60.0
    assert q2_score == 0.0

    # Deterministic average
    expected_overall = round((q1_score + q2_score) / 2)
    assert result.overallScore == expected_overall
    assert result.overallScore < q1_score  # Punished by the 0 score for unanswered turn


# ---------------------------------------------------------------------------
# Test Suite 5: Fallback Evaluator Does NOT Hallucinate 80/100
# ---------------------------------------------------------------------------

def test_fallback_evaluator_never_defaults_to_80():
    """Verify fallback_evaluation returns 0 on empty turns and never returns a hardcoded 80."""
    candidate_context = {"candidate": {"name": "Dave"}, "projects": []}
    res_empty = fallback_evaluation("Dave", candidate_context, [])
    assert res_empty.overallScore == 0
    assert res_empty.overallAssessment == INSUFFICIENT_EVIDENCE_ASSESSMENT

    turns_silence = [
        {"order": 1, "questionText": "Q1", "groundingSource": "p1", "transcript": "[silence]", "status": STATUS_UNANSWERED}
    ]
    res_silence = fallback_evaluation("Dave", candidate_context, turns_silence)
    assert res_silence.overallScore == 0
    assert res_silence.overallAssessment == INSUFFICIENT_EVIDENCE_ASSESSMENT


# ---------------------------------------------------------------------------
# Test Suite 6: API Integration & Idempotency
# ---------------------------------------------------------------------------

def test_save_answer_with_timed_out_status(sample_interview):
    """Verify /api/interview/answer accepts empty transcript when status is timed_out."""
    interview_id = sample_interview.id

    res = client.post(
        "/api/interview/answer",
        json={
            "interviewId": interview_id,
            "order": 1,
            "questionText": "Why ChromaDB for your project?",
            "groundingSource": "project:rag",
            "transcript": "",
            "status": "timed_out"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "timed_out"
    assert "nextQuestion" in data


def test_end_interview_idempotency(sample_interview):
    """Calling end_interview multiple times (e.g. manual end + timer expiry) must be idempotent."""
    interview_id = sample_interview.id

    # 1. End interview first time
    res1 = client.post("/api/interview/end", json={"interviewId": interview_id})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["success"] is True
    eval_id_1 = data1["evaluationId"]
    score_1 = data1["overallScore"]

    # 2. End interview second time (simulating timer expiry right after manual click)
    res2 = client.post("/api/interview/end", json={"interviewId": interview_id})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["success"] is True
    assert data2["evaluationId"] == eval_id_1
    assert data2["overallScore"] == score_1
