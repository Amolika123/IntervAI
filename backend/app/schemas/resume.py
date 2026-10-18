from typing import Dict, Any, Optional
from pydantic import BaseModel
from backend.app.services.resume_parser import CandidateProfile


class ResumeUploadResponse(BaseModel):
    success: bool = True
    userId: str
    resumeId: str
    parsedProfile: CandidateProfile
    candidateContext: Dict[str, Any]
