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
        if not candidate_context.projects or len(candidate_context.projects) == 0:
            raise HTTPException(
                status_code=422,
                detail="No technical projects could be identified from this resume. A technical interview requires at least one project. Please ensure your resume includes distinct projects with descriptions before starting."
            )
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

        # 1. Fetch past questions from completed interviews for this user to reduce repetition across interviews
        past_questions: List[str] = []
        try:
            past_interviews = (
                db.query(Interview)
                .filter(Interview.userId == resume.userId, Interview.id != interview.id)
                .all()
            )
            for prev_inv in past_interviews:
                for q in prev_inv.questions:
                    past_questions.append(q.questionText)
        except Exception as e:
            logger.warning(f"Could not load past interview history: {e}")

        # 2. Generate a fresh, interview-specific question bank (8-12 questions)
        from backend.app.services.question_bank import (
            generate_interview_question_bank,
            store_planned_questions,
            get_next_question_from_bank,
            cleanup_temporary_question_bank
        )

        planned_bank = await generate_interview_question_bank(
            candidate_context=context_dict,
            style_id=valid_style,
            previous_interviews_questions=past_questions
        )
        store_planned_questions(db, interview.id, planned_bank)

        return {
            "success": True,
            "interviewId": interview.id,
            "style": interview.style,
            "candidateContext": context_dict,
            "questionBankCount": len(planned_bank)
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

        # Retrieve the personalized first question from the newly generated question bank
        from backend.app.db.models import InterviewPlannedQuestion
        from backend.app.services.question_bank import get_next_question_from_bank, cleanup_temporary_question_bank

        first_planned = (
            db.query(InterviewPlannedQuestion)
            .filter(InterviewPlannedQuestion.interviewId == interview_id, InterviewPlannedQuestion.order == 1)
            .first()
        )

        p_list = candidate_context.get("projects", [])
        p1_name = p_list[0].get("name") if p_list else "your primary project"

        default_opening = f"Hello {candidate_context.get('candidate', {}).get('name', 'Candidate')}. Let's begin by discussing {p1_name}. Can you walk me through the technical implementation and design decisions?"
        opening_q_text = first_planned.questionText if first_planned else default_opening
        opening_q_source = first_planned.groundingSource if first_planned else f"project:{p1_name}:overview"

        if first_planned:
            first_planned.isAsked = True
            db.commit()

        api_key = settings.OPENAI_API_KEY
        if not api_key:
            # Mock mode for development without OpenAI Realtime key
            return {
                "success": True,
                "mockMode": True,
                "clientSecret": "mock_ephemeral_token_dev",
                "systemInstructions": system_prompt,
                "candidateContext": candidate_context,
                "style": style,
                "openingQuestion": opening_q_text,
                "openingSource": opening_q_source
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
                        "details": err_text,
                        "openingQuestion": opening_q_text,
                        "openingSource": opening_q_source
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
                "style": style,
                "openingQuestion": opening_q_text,
                "openingSource": opening_q_source
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
            "style": style,
            "openingQuestion": opening_q_text,
            "openingSource": opening_q_source
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
        if not payload.interviewId or not payload.questionText:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields (interviewId, questionText)"
            )

        status = payload.status or "answered"
        raw_transcript = (payload.transcript or "").strip()
        if not raw_transcript and status == "answered":
            status = "unanswered"

        from backend.app.services.question_bank import get_next_question_from_bank

        question = InterviewQuestion(
            interviewId=payload.interviewId,
            order=payload.order or 1,
            questionText=payload.questionText,
            groundingSource=payload.groundingSource or "resume:general",
            projectId=payload.projectId
        )
        db.add(question)
        db.flush()

        answer_meta = json.dumps({"status": status})
        answer = InterviewAnswer(
            interviewId=payload.interviewId,
            questionId=question.id,
            transcript=raw_transcript,
            evaluation=answer_meta
        )
        db.add(answer)
        db.commit()

        # Compute next unasked, non-repetitive question from the interview question bank
        next_q, next_order, next_source = get_next_question_from_bank(
            db=db,
            interview_id=payload.interviewId,
            candidate_answer=raw_transcript
        )

        return {
            "success": True,
            "questionId": question.id,
            "answerId": answer.id,
            "status": status,
            "nextQuestion": next_q,
            "nextOrder": next_order,
            "nextGroundingSource": next_source
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

        # Idempotency guard: If interview is already completed and has an evaluation, return it immediately
        if interview.status == "COMPLETED" and interview.evaluation:
            logger.info(f"Interview {interview_id} already finalized. Returning existing evaluation.")
            return {
                "success": True,
                "evaluationId": interview.evaluation.id,
                "overallScore": interview.evaluation.overallScore
            }

        candidate_context = json.loads(interview.candidateContext)
        candidate_name = candidate_context.get("candidate", {}).get("name", "Candidate")

        turns = []
        for q in interview.questions:
            status = "answered"
            transcript = ""
            if q.answer is not None:
                transcript = q.answer.transcript or ""
                if q.answer.evaluation:
                    try:
                        ans_meta = json.loads(q.answer.evaluation)
                        status = ans_meta.get("status", "answered")
                    except Exception:
                        status = "answered"
                if not transcript.strip() and status == "answered":
                    status = "unanswered"
            else:
                status = "unanswered"

            turns.append({
                "order": q.order,
                "questionText": q.questionText,
                "groundingSource": q.groundingSource,
                "transcript": transcript,
                "status": status
            })

        style_id = interview.style or "FAANG"
        eval_data = await generate_interview_evaluation(
            candidate_name=candidate_name,
            candidate_context=candidate_context,
            turns=turns,
            style_id=style_id
        )

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
            status = "unanswered"
            if q.answer:
                if q.answer.evaluation:
                    try:
                        ans_meta = json.loads(q.answer.evaluation)
                        status = ans_meta.get("status", "answered")
                    except Exception:
                        status = "answered"
                else:
                    status = "answered" if (q.answer.transcript or "").strip() else "unanswered"

            transcript_turns.append({
                "order": q.order,
                "questionText": q.questionText,
                "groundingSource": q.groundingSource,
                "transcript": q.answer.transcript if q.answer else None,
                "status": status,
                "createdAt": q.createdAt.isoformat() if q.createdAt else None
            })

        response_data = {
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

        # Lifecycle Phase: Evaluation saved and results delivered -> Purge temporary question bank
        try:
            from backend.app.services.question_bank import cleanup_temporary_question_bank
            cleanup_temporary_question_bank(db, interview_id)
        except Exception as cl_err:
            logger.warning(f"Notice during question bank cleanup: {cl_err}")

        return response_data

    except HTTPException:
        raise
    except Exception as error:
        logger.error(f"Fetch interview results API error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve interview results")


@router.post("/{interview_id}/cleanup")
async def cleanup_interview_question_bank_endpoint(
    interview_id: str,
    db: Session = Depends(get_db)
):
    try:
        from backend.app.services.question_bank import cleanup_temporary_question_bank
        deleted = cleanup_temporary_question_bank(db, interview_id)
        return {
            "success": True,
            "interviewId": interview_id,
            "deletedPlannedQuestions": deleted
        }
    except Exception as error:
        logger.error(f"Cleanup endpoint error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to cleanup question bank")

