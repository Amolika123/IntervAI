import json
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import httpx

from backend.app.config.settings import settings
from backend.app.db.session import get_db
from backend.app.db.models import (
    Resume,
    Interview,
    InterviewQuestion,
    InterviewAnswer,
    Evaluation,
)
from backend.app.schemas.interview import (
    InterviewStartRequest,
    InterviewSessionRequest,
    InterviewAnswerRequest,
    InterviewEndRequest,
)
from backend.app.services.candidate_context_builder import build_candidate_context
from backend.app.services.resume_parser import CandidateProfile
from backend.app.services.system_prompt import build_interviewer_system_prompt
from backend.app.services.evaluator import generate_interview_evaluation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/interview", tags=["interview"])


@router.post("/start")
async def start_interview(
    payload: InterviewStartRequest,
    db: Session = Depends(get_db)
):
    try:
        resume_id = payload.resumeId
        if not resume_id:
            raise HTTPException(status_code=400, detail="resumeId is required")

        valid_style = payload.style if payload.style in ("FAANG", "MANGOS", "BIG_4") else "FAANG"

        resume = db.query(Resume).filter(Resume.id == resume_id).first()
        if not resume:
            raise HTTPException(status_code=404, detail="Resume record not found")

        parsed_profile_dict = json.loads(resume.parsedProfile)
        profile_model = CandidateProfile(**parsed_profile_dict)
        candidate_context = await build_candidate_context(profile_model)
        context_dict = candidate_context.model_dump()

        interview = Interview(
            userId=resume.userId,
            resumeId=resume.id,
            status="CREATED",
            style=valid_style,
            candidateContext=json.dumps(context_dict)
        )
        db.add(interview)
        db.commit()
        db.refresh(interview)

        return {
            "success": True,
            "interviewId": interview.id,
            "style": interview.style,
            "candidateContext": context_dict
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Start interview endpoint error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start interview session")


@router.post("/session")
async def create_session(
    payload: InterviewSessionRequest,
    db: Session = Depends(get_db)
):
    try:
        interview_id = payload.interviewId
        if not interview_id:
            raise HTTPException(status_code=400, detail="interviewId is required")

        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        candidate_context = json.loads(interview.candidateContext)
        style = interview.style or "FAANG"
        system_prompt = build_interviewer_system_prompt(candidate_context, style)

        api_key = settings.OPENAI_API_KEY
        if not api_key:
            # Mock mode for development without OpenAI Realtime key
            return {
                "success": True,
                "mockMode": True,
                "clientSecret": "mock_ephemeral_token_dev",
                "systemInstructions": system_prompt,
                "candidateContext": candidate_context,
                "style": style
            }

        # Call official OpenAI Realtime Ephemeral Session Creation API
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.openai.com/v1/realtime/sessions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "gpt-4o-realtime-preview-2024-12-17",
                        "voice": "verse",
                        "instructions": system_prompt,
                        "input_audio_transcription": {
                            "model": "whisper-1"
                        },
                        "turn_detection": {
                            "type": "server_vad",
                            "threshold": 0.5,
                            "prefix_padding_ms": 300,
                            "silence_duration_ms": 600
                        }
                    }
                )

                if res.status_code != 200:
                    err_text = res.text
                    logger.error(f"OpenAI Realtime Session creation error: {err_text}")
                    return {
                        "success": False,
                        "error": "Failed to create OpenAI Realtime session",
                        "details": err_text
                    }

                session_data = res.json()
        except Exception as e:
            logger.warning(f"Realtime session creation call error: {e}")
            return {
                "success": True,
                "mockMode": True,
                "clientSecret": "mock_ephemeral_token_dev",
                "systemInstructions": system_prompt,
                "candidateContext": candidate_context,
                "style": style
            }

        # Update interview status to IN_PROGRESS
        interview.status = "IN_PROGRESS"
        interview.startedAt = datetime.utcnow()
        db.commit()

        client_secret = (
            session_data.get("client_secret", {}).get("value")
            if isinstance(session_data.get("client_secret"), dict)
            else session_data.get("id")
        )

        return {
            "success": True,
            "clientSecret": client_secret,
            "sessionData": session_data,
            "systemInstructions": system_prompt,
            "candidateContext": candidate_context,
            "style": style
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Session generation API error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/answer")
async def save_answer(
    payload: InterviewAnswerRequest,
    db: Session = Depends(get_db)
):
    try:
        if not payload.interviewId or not payload.questionText or not payload.transcript:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields (interviewId, questionText, transcript)"
            )

        question = InterviewQuestion(
            interviewId=payload.interviewId,
            order=payload.order or 1,
            questionText=payload.questionText,
            groundingSource=payload.groundingSource or "resume:general",
            projectId=payload.projectId
        )
        db.add(question)
        db.flush()

        answer = InterviewAnswer(
            interviewId=payload.interviewId,
            questionId=question.id,
            transcript=payload.transcript
        )
        db.add(answer)
        db.commit()

        return {
            "success": True,
            "questionId": question.id,
            "answerId": answer.id
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Save answer endpoint error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to persist interview turn")


@router.post("/end")
async def end_interview(
    payload: InterviewEndRequest,
    db: Session = Depends(get_db)
):
    try:
        interview_id = payload.interviewId
        if not interview_id:
            raise HTTPException(status_code=400, detail="interviewId is required")

        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        candidate_context = json.loads(interview.candidateContext)
        candidate_name = candidate_context.get("candidate", {}).get("name", "Candidate")

        turns = []
        for q in interview.questions:
            if q.answer is not None:
                turns.append({
                    "order": q.order,
                    "questionText": q.questionText,
                    "groundingSource": q.groundingSource,
                    "transcript": q.answer.transcript
                })

        eval_data = await generate_interview_evaluation(candidate_name, candidate_context, turns)

        evaluation = db.query(Evaluation).filter(Evaluation.interviewId == interview_id).first()
        if evaluation:
            evaluation.overallScore = round(eval_data.overallScore)
            evaluation.overallAssessment = eval_data.overallAssessment
            evaluation.strengths = json.dumps(eval_data.strengths)
            evaluation.areasToImprove = json.dumps(eval_data.areasToImprove)
            evaluation.questionBreakdown = json.dumps([b.model_dump() for b in eval_data.questionBreakdown])
        else:
            evaluation = Evaluation(
                interviewId=interview_id,
                overallScore=round(eval_data.overallScore),
                overallAssessment=eval_data.overallAssessment,
                strengths=json.dumps(eval_data.strengths),
                areasToImprove=json.dumps(eval_data.areasToImprove),
                questionBreakdown=json.dumps([b.model_dump() for b in eval_data.questionBreakdown])
            )
            db.add(evaluation)

        interview.status = "COMPLETED"
        interview.endedAt = datetime.utcnow()
        db.commit()
        db.refresh(evaluation)

        return {
            "success": True,
            "evaluationId": evaluation.id,
            "overallScore": evaluation.overallScore
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Finalize interview API error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to finalize interview evaluation")


@router.get("/{interview_id}/results")
async def get_results(
    interview_id: str,
    db: Session = Depends(get_db)
):
    try:
        interview = db.query(Interview).filter(Interview.id == interview_id).first()
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")

        candidate_context = json.loads(interview.candidateContext)

        evaluation = None
        if interview.evaluation:
            evaluation = {
                "id": interview.evaluation.id,
                "overallScore": interview.evaluation.overallScore,
                "overallAssessment": interview.evaluation.overallAssessment,
                "strengths": json.loads(interview.evaluation.strengths),
                "areasToImprove": json.loads(interview.evaluation.areasToImprove),
                "questionBreakdown": json.loads(interview.evaluation.questionBreakdown)
            }

        transcript_turns = []
        for q in interview.questions:
            transcript_turns.append({
                "order": q.order,
                "questionText": q.questionText,
                "groundingSource": q.groundingSource,
                "transcript": q.answer.transcript if q.answer else None,
                "createdAt": q.createdAt.isoformat() if q.createdAt else None
            })

        return {
            "success": True,
            "interview": {
                "id": interview.id,
                "status": interview.status,
                "style": interview.style,
                "startedAt": interview.startedAt.isoformat() if interview.startedAt else None,
                "endedAt": interview.endedAt.isoformat() if interview.endedAt else None,
                "createdAt": interview.createdAt.isoformat() if interview.createdAt else None
            },
            "candidate": candidate_context.get("candidate", {}),
            "projects": candidate_context.get("projects", []),
            "evaluation": evaluation,
            "transcript": transcript_turns
        }

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Fetch interview results API error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve interview results")
