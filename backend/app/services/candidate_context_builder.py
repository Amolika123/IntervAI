from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from backend.app.services.resume_parser import CandidateProfile
from backend.app.services.github_service import fetch_github_repo_details, GitHubRepoDetails, ContextSourceType


class CompiledProjectContext(BaseModel):
    id: Optional[str] = None
    name: str
    resumeDescription: str
    technologies: List[str] = Field(default_factory=list)
    githubUrl: Optional[str] = None
    githubOwner: Optional[str] = None
    githubRepo: Optional[str] = None
    repositoryAccessible: bool = False
    readmeAvailable: bool = False
    readmeText: Optional[str] = None
    repositoryStructure: Optional[List[str]] = Field(default_factory=list)
    contextSource: ContextSourceType = "resume_only"


class CandidateSummary(BaseModel):
    name: str
    education: List[Dict[str, Any]] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    experience: List[Dict[str, Any]] = Field(default_factory=list)


class CandidateContext(BaseModel):
    candidate: CandidateSummary
    projects: List[CompiledProjectContext] = Field(default_factory=list)


async def build_candidate_context(profile: CandidateProfile) -> CandidateContext:
    """
    Builds the standardized CandidateContext dossier by aggregating candidate
    resume claims with public GitHub repository metadata, README documentation,
    and codebase tree structure.
    """
    processed_projects: List[CompiledProjectContext] = []

    for proj in profile.projects:
        if proj.url and "github.com" in proj.url:
            gh_details: GitHubRepoDetails = await fetch_github_repo_details(proj.url)
            processed_projects.append(CompiledProjectContext(
                name=proj.name,
                resumeDescription=proj.description,
                technologies=proj.technologies or [],
                githubUrl=gh_details.githubUrl,
                githubOwner=gh_details.owner,
                githubRepo=gh_details.repo,
                repositoryAccessible=gh_details.repositoryAccessible,
                readmeAvailable=gh_details.readmeAvailable,
                readmeText=gh_details.readmeContent,
                repositoryStructure=gh_details.fileTree,
                contextSource=gh_details.contextSource
            ))
        else:
            processed_projects.append(CompiledProjectContext(
                name=proj.name,
                resumeDescription=proj.description,
                technologies=proj.technologies or [],
                githubUrl=proj.url,
                repositoryAccessible=False,
                readmeAvailable=False,
                contextSource="resume_only"
            ))

    education_data = [e.model_dump() for e in profile.education]
    experience_data = [e.model_dump() for e in profile.experience]

    return CandidateContext(
        candidate=CandidateSummary(
            name=profile.name or "Candidate",
            education=education_data,
            skills=profile.skills or [],
            technologies=profile.technologies or [],
            experience=experience_data
        ),
        projects=processed_projects
    )
