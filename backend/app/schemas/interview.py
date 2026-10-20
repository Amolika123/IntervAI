from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class InterviewStartRequest(BaseModel):
    resumeId: str
    style: Optional[str] = "FAANG"


class InterviewStartResponse(BaseModel):
    success: bool = True
    interviewId: str
    style: str
    candidateContext: Dict[str, Any]


class InterviewSessionRequest(BaseModel):
    interviewId: str


class InterviewSessionResponse(BaseModel):
    success: bool = True
    clientSecret: Optional[str] = None
    sessionData: Optional[Dict[str, Any]] = None
    systemInstructions: str
    candidateContext: Dict[str, Any]
    style: str
    mockMode: Optional[bool] = None


class InterviewAnswerRequest(BaseModel):
    interviewId: str
    order: Optional[int] = 1
    questionText: Optional[str] = None
    question: Optional[str] = None
    groundingSource: Optional[str] = "resume:general"
    grounding_source: Optional[str] = None
    transcript: Optional[str] = ""
    answer: Optional[str] = None
    status: Optional[str] = "answered"
    projectId: Optional[str] = None
    style: Optional[str] = None

    def get_question_text(self) -> str:
        return (self.questionText or self.question or "").strip()

    def get_transcript(self) -> str:
        if self.transcript is not None and self.transcript != "":
            return self.transcript
        return self.answer or ""

    def get_grounding_source(self) -> str:
        return self.groundingSource or self.grounding_source or "resume:general"


class InterviewAnswerResponse(BaseModel):
    success: bool = True
    questionId: str
    answerId: str


class InterviewEndRequest(BaseModel):
    interviewId: str


class InterviewEndResponse(BaseModel):
    success: bool = True
    evaluationId: str
    overallScore: int


class InterviewTurnItem(BaseModel):
    order: int
    questionText: str
    groundingSource: str
    transcript: Optional[str] = None
    createdAt: Optional[Any] = None


class InterviewMetadata(BaseModel):
    id: str
    status: str
    style: str
    startedAt: Optional[Any] = None
    endedAt: Optional[Any] = None
    createdAt: Optional[Any] = None


class InterviewResultsResponse(BaseModel):
    success: bool = True
    interview: InterviewMetadata
    candidate: Dict[str, Any]
    projects: List[Dict[str, Any]]
    evaluation: Optional[Dict[str, Any]] = None
    transcript: List[InterviewTurnItem]
