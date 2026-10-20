import json
import logging
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import openai
from backend.app.config.settings import settings
from backend.app.config.interview_config import (
    RUBRIC_WEIGHTS,
    STATUS_ANSWERED,
    STATUS_UNANSWERED,
    STATUS_TIMED_OUT,
    STATUS_TRANSCRIPTION_FAILED,
    INSUFFICIENT_EVIDENCE_ASSESSMENT,
)

logger = logging.getLogger(__name__)

FILLER_WORDS = {
    "um", "uh", "uhm", "umm", "hmm", "hm", "ah", "er", "like", "so",
    "you know", "...", "[silence]", "silence", "nothing", "none"
}


def is_empty_or_filler_transcript(transcript: Optional[str]) -> bool:
    """Returns True if the transcript is empty, whitespace, or filler-only."""
    if not transcript:
        return True
    cleaned = re.sub(r"[^\w\s]", "", transcript.strip().lower())
    words = cleaned.split()
    if not words:
        return True
    # If all words are filler words, consider it non-assessable
    return all(w in FILLER_WORDS for w in words)


class QuestionBreakdownItem(BaseModel):
    order: int
    questionText: str
    groundingSource: str
    transcript: str
    status: str = STATUS_ANSWERED
    technicalCorrectnessScore: float = Field(default=0.0, ge=0.0, le=100.0)
    completenessScore: float = Field(default=0.0, ge=0.0, le=100.0)
    depthLevelScore: float = Field(default=0.0, ge=0.0, le=100.0)
    relevanceScore: float = Field(default=0.0, ge=0.0, le=100.0)
    questionScore: float = Field(default=0.0, ge=0.0, le=100.0)
    relevance: str = "Off-topic"  # UI backwards compatibility ("Strong", "Partial", "Vague", "Off-topic")
    technicalCorrectness: str = "Incorrect"  # UI backwards compatibility ("Correct", "Partially Correct", "Incorrect")
    depthLevel: str = "Basic"  # UI backwards compatibility ("Basic", "Intermediate", "Deep/Architectural")
    feedback: str
    suggestedImprovement: str = ""


class EvaluationResult(BaseModel):
    overallScore: int = Field(default=0, ge=0, le=100)
    overallAssessment: str
    strengths: List[str] = Field(default_factory=list)
    areasToImprove: List[str] = Field(default_factory=list)
    questionBreakdown: List[QuestionBreakdownItem] = Field(default_factory=list)


def calculate_question_weighted_score(
    technical_correctness: float,
    completeness: float,
    depth: float,
    relevance: float
) -> float:
    """
    Deterministic backend calculation of Question Score using rubric weights:
    Question Score = (Technical Correctness * 0.40) + (Completeness * 0.25) + (Depth * 0.20) + (Relevance * 0.15)
    """
    score = (
        (technical_correctness * RUBRIC_WEIGHTS["technicalCorrectness"])
        + (completeness * RUBRIC_WEIGHTS["completeness"])
        + (depth * RUBRIC_WEIGHTS["depthLevel"])
        + (relevance * RUBRIC_WEIGHTS["relevance"])
    )
    return round(max(0.0, min(100.0, score)), 1)


def score_to_relevance_label(score: float) -> str:
    if score >= 75.0:
        return "Strong"
    elif score >= 50.0:
        return "Partial"
    elif score >= 25.0:
        return "Vague"
    return "Off-topic"


def score_to_correctness_label(score: float) -> str:
    if score >= 70.0:
        return "Correct"
    elif score >= 40.0:
        return "Partially Correct"
    return "Incorrect"


def score_to_depth_label(score: float) -> str:
    if score >= 75.0:
        return "Deep/Architectural"
    elif score >= 45.0:
        return "Intermediate"
    return "Basic"


def evaluate_unanswered_turn(
    order: int,
    question_text: str,
    grounding_source: str,
    transcript: str,
    status: str
) -> QuestionBreakdownItem:
    """Generates an explicit zero-scoring breakdown for an unanswered, timed-out, or failed turn."""
    if status == STATUS_TIMED_OUT:
        feedback = "Time expired before an answer was provided."
        suggestion = "Pace responses to address key architectural decisions within the time limit."
    elif status == STATUS_TRANSCRIPTION_FAILED:
        feedback = "Answer could not be evaluated due to audio transcription failure."
        suggestion = "Ensure microphone input is functioning properly and background noise is minimized."
    else:
        status = STATUS_UNANSWERED
        feedback = "No assessable answer was received."
        suggestion = "Provide a structured technical explanation detailing system implementation, components, and design choices."

    return QuestionBreakdownItem(
        order=order,
        questionText=question_text,
        groundingSource=grounding_source,
        transcript=transcript if transcript else "[No response recorded]",
        status=status,
        technicalCorrectnessScore=0.0,
        completenessScore=0.0,
        depthLevelScore=0.0,
        relevanceScore=0.0,
        questionScore=0.0,
        relevance="Off-topic",
        technicalCorrectness="Incorrect",
        depthLevel="Basic",
        feedback=feedback,
        suggestedImprovement=suggestion,
    )


def fallback_evaluation(
    candidate_name: str,
    candidate_context: Dict[str, Any],
    turns: List[Dict[str, Any]]
) -> EvaluationResult:
    """
    Deterministic rule-based fallback evaluation generator.
    NEVER defaults to 80/100.
    NEVER fabricates questions or answers.
    Evaluates what the candidate actually said against candidate context technologies.
    """
    if not turns:
        return EvaluationResult(
            overallScore=0,
            overallAssessment=INSUFFICIENT_EVIDENCE_ASSESSMENT,
            strengths=[],
            areasToImprove=[
                "No technical answers were recorded during the interview session.",
                "Ensure microphone permissions are granted and respond aloud to interviewer prompts."
            ],
            questionBreakdown=[]
        )

    # Extract candidate technologies for keyword matching
    known_tech = set()
    for p in candidate_context.get("projects", []):
        for t in p.get("technologies", []):
            known_tech.add(t.lower())
    cand = candidate_context.get("candidate", {})
    for s in cand.get("skills", []) + cand.get("technologies", []):
        known_tech.add(s.lower())

    breakdown: List[QuestionBreakdownItem] = []
    answered_scores: List[float] = []

    for idx, t in enumerate(turns):
        order = t.get("order", idx + 1)
        q_text = t.get("questionText", "")
        source = t.get("groundingSource", "resume_only")
        raw_transcript = (t.get("transcript") or "").strip()
        status = t.get("status", STATUS_ANSWERED)

        if status != STATUS_ANSWERED or is_empty_or_filler_transcript(raw_transcript):
            item = evaluate_unanswered_turn(order, q_text, source, raw_transcript, status)
            breakdown.append(item)
            continue

        # Candidate answered - assess length, technical terms, and structure
        words = raw_transcript.split()
        word_count = len(words)
        lower_transcript = raw_transcript.lower()
        matched_terms = [tech for tech in known_tech if tech in lower_transcript]

        if word_count < 8:
            # Very short / incomplete answer
            corr = 35.0
            comp = 25.0
            depth = 20.0
            rel = 60.0
            fb = "Identified basic concepts but lacked implementation details or architectural reasoning."
            sugg = "Expand on component interactions, data flows, and trade-offs."
        elif word_count < 25:
            # Concise answer
            corr = 65.0 + min(15.0, len(matched_terms) * 5.0)
            comp = 55.0
            depth = 50.0
            rel = 80.0
            fb = "Provided a direct answer addressing core concepts. Could offer more depth on failure modes and scaling."
            sugg = "Discuss edge cases, error recovery, and performance benchmarks."
        else:
            # Detailed answer
            corr = min(92.0, 75.0 + len(matched_terms) * 4.0)
            comp = 80.0
            depth = 75.0
            rel = 90.0
            fb = "Demonstrated solid technical explanation with specific references to implementation and technologies."
            sugg = "Elaborate further on trade-offs against alternative architectural solutions."

        q_score = calculate_question_weighted_score(corr, comp, depth, rel)
        answered_scores.append(q_score)

        breakdown.append(QuestionBreakdownItem(
            order=order,
            questionText=q_text,
            groundingSource=source,
            transcript=raw_transcript,
            status=STATUS_ANSWERED,
            technicalCorrectnessScore=corr,
            completenessScore=comp,
            depthLevelScore=depth,
            relevanceScore=rel,
            questionScore=q_score,
            relevance=score_to_relevance_label(rel),
            technicalCorrectness=score_to_correctness_label(corr),
            depthLevel=score_to_depth_label(depth),
            feedback=fb,
            suggestedImprovement=sugg
        ))

    # Deterministic Overall Score: Average across all asked questions (unanswered count as 0)
    all_scores = [q.questionScore for q in breakdown]
    if not all_scores or all(s == 0.0 for s in all_scores):
        return EvaluationResult(
            overallScore=0,
            overallAssessment=INSUFFICIENT_EVIDENCE_ASSESSMENT,
            strengths=[],
            areasToImprove=[
                "Candidate did not provide recorded responses to technical questions.",
                "Ensure microphone is active and respond to each question within the time limit."
            ],
            questionBreakdown=breakdown
        )

    final_overall = round(sum(all_scores) / len(all_scores))

    strengths = []
    if final_overall >= 75:
        strengths.append("Strong technical explanations across project implementation details.")
        strengths.append("Effective grounding in project architectures and relevant technology choices.")
    elif final_overall >= 50:
        strengths.append("Foundational understanding of core technologies used in projects.")
        strengths.append("Direct responses to primary interview questions.")
    else:
        strengths.append("Willingness to engage with technical questions.")

    areas_to_improve = [
        "Provide deeper analysis of algorithmic complexity and resource scaling limits.",
        "Detail specific trade-offs and alternative architectures evaluated during implementation."
    ]

    return EvaluationResult(
        overallScore=final_overall,
        overallAssessment=(
            f"{candidate_name} completed a technical interview. "
            f"Overall performance reflects a score of {final_overall}/100 calculated across all asked questions."
        ),
        strengths=strengths,
        areasToImprove=areas_to_improve,
        questionBreakdown=breakdown
    )


async def generate_interview_evaluation(
    candidate_name: str,
    candidate_context: Dict[str, Any],
    turns: List[Dict[str, Any]],
    style_id: str = "FAANG"
) -> EvaluationResult:
    """
    Evaluates candidate performance across asked questions using OpenAI GPT-4o
    with deterministic backend score calculation, or falls back to rule-based evaluation.
    Guarantees:
    - Empty or filler answers receive 0.
    - Overall score is deterministically computed from per-question rubric scores.
    - If no valid answers exist, returns 0 and INSUFFICIENT_EVIDENCE_ASSESSMENT.
    """
    if not turns:
        return fallback_evaluation(candidate_name, candidate_context, [])

    # Check if all turns are empty/unanswered up front
    has_any_answer = False
    for t in turns:
        status = t.get("status", STATUS_ANSWERED)
        transcript = (t.get("transcript") or "").strip()
        if status == STATUS_ANSWERED and not is_empty_or_filler_transcript(transcript):
            has_any_answer = True
            break

    if not has_any_answer:
        # All turns empty / unanswered / timed out
        return fallback_evaluation(candidate_name, candidate_context, turns)

    api_key = settings.OPENAI_API_KEY
    if api_key:
        try:
            client = openai.OpenAI(api_key=api_key)

            formatted_turns = []
            for idx, t in enumerate(turns):
                order = t.get("order", idx + 1)
                q_text = t.get("questionText", "")
                raw_transcript = (t.get("transcript") or "").strip()
                status = t.get("status", STATUS_ANSWERED)

                if status != STATUS_ANSWERED or is_empty_or_filler_transcript(raw_transcript):
                    turn_desc = (
                        f"TURN #{order}\n"
                        f"Question: \"{q_text}\"\n"
                        f"Status: {status} (No valid answer was provided by candidate)\n"
                    )
                else:
                    turn_desc = (
                        f"TURN #{order}\n"
                        f"Question: \"{q_text}\"\n"
                        f"Candidate Answer: \"{raw_transcript}\"\n"
                    )
                formatted_turns.append(turn_desc)

            transcript_text = "\n----------------------------------------\n".join(formatted_turns)

            system_eval_prompt = f"""
You are a rigorous Principal Software Architect conducting an objective technical evaluation.
Candidate Name: {candidate_name}
Selected Company Style Preset: {style_id}

SCORING RUBRIC & RULES (STRICTLY MANDATORY):
1. Evaluate ONLY what the candidate actually stated in their answer. Never infer knowledge not present in the answer.
2. For any turn marked as unanswered, timed out, or containing silence/filler words, assign EXACTLY 0.0 for all four dimensions.
3. Dimension Scores (each 0.0 to 100.0):
   - technicalCorrectness: Accuracy of technical facts, algorithms, and system mechanics.
   - completeness: How thoroughly the answer addresses the question components.
   - depthLevel: Depth of engineering reasoning (trade-offs, bottlenecks, failure modes).
   - relevance: Direct alignment with the specific technical question asked.
4. Provide constructive feedback citing specific statements made by the candidate.
5. Provide a specific suggestedImprovement for each question.
"""

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_eval_prompt},
                    {
                        "role": "user",
                        "content": (
                            f"Candidate Context Dossier:\n{json.dumps(candidate_context, indent=2)}\n\n"
                            f"Interview Turns to Evaluate:\n{transcript_text}\n\n"
                            f"Evaluate each turn and provide structured scores."
                        )
                    }
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "interview_evaluation_report",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "overallAssessment": {"type": "string"},
                                "strengths": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "areasToImprove": {
                                    "type": "array",
                                    "items": {"type": "string"}
                                },
                                "questionBreakdown": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "order": {"type": "integer"},
                                            "technicalCorrectnessScore": {"type": "number"},
                                            "completenessScore": {"type": "number"},
                                            "depthLevelScore": {"type": "number"},
                                            "relevanceScore": {"type": "number"},
                                            "feedback": {"type": "string"},
                                            "suggestedImprovement": {"type": "string"}
                                        },
                                        "required": [
                                            "order",
                                            "technicalCorrectnessScore",
                                            "completenessScore",
                                            "depthLevelScore",
                                            "relevanceScore",
                                            "feedback",
                                            "suggestedImprovement"
                                        ],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": [
                                "overallAssessment",
                                "strengths",
                                "areasToImprove",
                                "questionBreakdown"
                            ],
                            "additionalProperties": False
                        }
                    }
                }
            )

            raw_content = response.choices[0].message.content
            if raw_content:
                parsed_json = json.loads(raw_content)

                # Merge model outputs with deterministic backend score calculation
                breakdown: List[QuestionBreakdownItem] = []
                evaluated_map = {item["order"]: item for item in parsed_json.get("questionBreakdown", [])}

                for idx, t in enumerate(turns):
                    order = t.get("order", idx + 1)
                    q_text = t.get("questionText", "")
                    source = t.get("groundingSource", "resume_only")
                    raw_transcript = (t.get("transcript") or "").strip()
                    status = t.get("status", STATUS_ANSWERED)

                    if status != STATUS_ANSWERED or is_empty_or_filler_transcript(raw_transcript):
                        breakdown.append(evaluate_unanswered_turn(order, q_text, source, raw_transcript, status))
                        continue

                    model_item = evaluated_map.get(order, {})
                    corr = float(max(0.0, min(100.0, model_item.get("technicalCorrectnessScore", 50.0))))
                    comp = float(max(0.0, min(100.0, model_item.get("completenessScore", 50.0))))
                    depth = float(max(0.0, min(100.0, model_item.get("depthLevelScore", 50.0))))
                    rel = float(max(0.0, min(100.0, model_item.get("relevanceScore", 50.0))))

                    # Deterministic backend formula
                    q_score = calculate_question_weighted_score(corr, comp, depth, rel)

                    breakdown.append(QuestionBreakdownItem(
                        order=order,
                        questionText=q_text,
                        groundingSource=source,
                        transcript=raw_transcript,
                        status=STATUS_ANSWERED,
                        technicalCorrectnessScore=corr,
                        completenessScore=comp,
                        depthLevelScore=depth,
                        relevanceScore=rel,
                        questionScore=q_score,
                        relevance=score_to_relevance_label(rel),
                        technicalCorrectness=score_to_correctness_label(corr),
                        depthLevel=score_to_depth_label(depth),
                        feedback=model_item.get("feedback", "Answer evaluated against technical criteria."),
                        suggestedImprovement=model_item.get("suggestedImprovement", "")
                    ))

                # Deterministic overall score calculation
                all_q_scores = [item.questionScore for item in breakdown]
                deterministic_overall = round(sum(all_q_scores) / len(all_q_scores)) if all_q_scores else 0

                return EvaluationResult(
                    overallScore=deterministic_overall,
                    overallAssessment=parsed_json.get("overallAssessment", ""),
                    strengths=parsed_json.get("strengths", []),
                    areasToImprove=parsed_json.get("areasToImprove", []),
                    questionBreakdown=breakdown
                )
        except Exception as e:
            logger.warning(f"OpenAI evaluation failed, using deterministic fallback evaluator: {e}")

    return fallback_evaluation(candidate_name, candidate_context, turns)
