"""
Central configuration for Interview Timers, Deadlines, and Scoring Rubrics.
Single source of truth across IntervAI.
"""

# Total Interview Timer (40 minutes default)
TOTAL_INTERVIEW_DURATION_SECONDS: int = 40 * 60  # 2400 seconds

# Total Interview Warnings
TOTAL_WARNING_5MIN_SECONDS: int = 5 * 60  # 300 seconds (5 minutes)
TOTAL_WARNING_1MIN_SECONDS: int = 60      # 60 seconds (1 minute)
TOTAL_WARNING_10SEC_SECONDS: int = 10     # 10 seconds (final warning)

# Per-Question Answer Timer (90 seconds default)
PER_QUESTION_DURATION_SECONDS: int = 90  # 90 seconds

# Per-Question Warnings
QUESTION_WARNING_15SEC_SECONDS: int = 15
QUESTION_WARNING_5SEC_SECONDS: int = 5

# Transparent Per-Question Rubric Weights (Must sum to 1.0)
RUBRIC_WEIGHTS = {
    "technicalCorrectness": 0.40,
    "completeness": 0.25,
    "depthLevel": 0.20,
    "relevance": 0.15,
}

# Answer Status Constants
STATUS_ANSWERED = "answered"
STATUS_UNANSWERED = "unanswered"
STATUS_TIMED_OUT = "timed_out"
STATUS_TRANSCRIPTION_FAILED = "transcription_failed"

INSUFFICIENT_EVIDENCE_ASSESSMENT = (
    "Insufficient evidence to assess technical ability. No valid answers were recorded."
)
