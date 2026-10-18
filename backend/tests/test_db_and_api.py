import json
import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import User, Resume, Interview, InterviewQuestion, InterviewAnswer, Evaluation


client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_sqlite_db_reads():
    db = SessionLocal()
    users = db.query(User).all()
    assert len(users) > 0, "Existing SQLite database should contain users from previous runs"
    resumes = db.query(Resume).all()
    assert len(resumes) > 0
    db.close()


def test_full_api_workflow_lifecycle():
    # 1. Test Resume Upload with a text-based PDF or fallback
    # Create a small valid PDF header/content
    pdf_content = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /Contents 4 0 R >>\nendobj\n"
        b"4 0 obj\n<< /Length 120 >>\nstream\n"
        b"BT\n/F1 12 Tf\n72 712 Td\n(Alex Candidate - AI Engineer Python ChromaDB React https://github.com/torvalds/linux) Tj\nET\n"
        b"endstream\nendobj\nxref\n0 5\n0000000000 65535 f \n"
        b"trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n400\n%%EOF\n"
    )

    upload_res = client.post(
        "/api/resume/upload",
        files={"file": ("test_resume.pdf", pdf_content, "application/pdf")}
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert upload_data["success"] is True
    assert "resumeId" in upload_data
    resume_id = upload_data["resumeId"]

    # 2. Test Interview Start with MANGOS preset
    start_res = client.post(
        "/api/interview/start",
        json={"resumeId": resume_id, "style": "MANGOS"}
    )
    assert start_res.status_code == 200
    start_data = start_res.json()
    assert start_data["success"] is True
    assert start_data["style"] == "MANGOS"
    interview_id = start_data["interviewId"]

    # 3. Test Session Generation
    session_res = client.post(
        "/api/interview/session",
        json={"interviewId": interview_id}
    )
    assert session_res.status_code == 200
    session_data = session_res.json()
    assert session_data["success"] is True
    assert session_data["style"] == "MANGOS"
    assert "STYLE PRESET: MANGOS" in session_data["systemInstructions"]

    # 4. Test Saving an Interview Turn (Answer)
    answer_res = client.post(
        "/api/interview/answer",
        json={
            "interviewId": interview_id,
            "order": 1,
            "questionText": "Can you explain how ChromaDB handles vector retrieval at scale?",
            "groundingSource": "project:Linux:README",
            "transcript": "We used cosine similarity indexing with an in-memory ChromaDB collection."
        }
    )
    assert answer_res.status_code == 200
    answer_data = answer_res.json()
    assert answer_data["success"] is True
    assert "questionId" in answer_data
    assert "answerId" in answer_data

    # 5. Test Ending Interview and Evaluation Generation
    end_res = client.post(
        "/api/interview/end",
        json={"interviewId": interview_id}
    )
    assert end_res.status_code == 200
    end_data = end_res.json()
    assert end_data["success"] is True
    assert "overallScore" in end_data
    assert 0 <= end_data["overallScore"] <= 100

    # 6. Test Retrieving Results
    results_res = client.get(f"/api/interview/{interview_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data["success"] is True
    assert results_data["interview"]["id"] == interview_id
    assert results_data["interview"]["style"] == "MANGOS"
    assert results_data["interview"]["status"] == "COMPLETED"
    assert results_data["evaluation"] is not None
    assert len(results_data["transcript"]) >= 1


def test_tts_endpoint():
    res = client.post("/api/tts", json={"text": "Hello, welcome to IntervAI."})
    assert res.status_code == 200
    # Either returns audio/mpeg bytes or { "fallback": true } if no OpenAI API key
    if res.headers.get("content-type") == "audio/mpeg":
        assert len(res.content) > 0
    else:
        data = res.json()
        assert data.get("fallback") is True
