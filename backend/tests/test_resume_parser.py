import pytest
from backend.app.services.resume_parser import (
    extract_github_urls_from_text,
    fallback_rule_based_parser,
    CandidateProfile,
    EducationItem,
    ExperienceItem,
    ProjectItem,
)


def test_extract_github_urls_clean():
    sample_text = """
    Jane Doe - AI Engineer
    Project: RAG Fake News Detector
    Link: https://github.com/janedoe/fake-news-rag.
    Other: https://github.com/janedoe/vision-model/
    Built using ChromaDB and PyTorch.
    """
    urls = extract_github_urls_from_text(sample_text)
    assert len(urls) == 2
    assert "https://github.com/janedoe/fake-news-rag" in urls
    assert "https://github.com/janedoe/vision-model" in urls
    assert not urls[0].endswith(".")
    assert not urls[1].endswith("/")


def test_fallback_rule_based_parser():
    sample_text = """Jane Doe
Senior Full-Stack Engineer
Built a RAG application using ChromaDB, Python, PyTorch, and FastAPI.
GitHub Project: https://github.com/janedoe/rag-app
Experienced with PostgreSQL, Docker, and React."""
    
    profile = fallback_rule_based_parser(sample_text)
    assert isinstance(profile, CandidateProfile)
    assert profile.name == "Jane Doe"
    assert "Python" in profile.skills or "ChromaDB" in profile.skills
    assert len(profile.projects) >= 1
    assert profile.projects[0].url == "https://github.com/janedoe/rag-app"


def test_candidate_profile_schema_validation():
    profile = CandidateProfile(
        name="Alex Smith",
        skills=["Python", "FastAPI", "PostgreSQL"],
        technologies=["Docker", "AWS"],
        education=[EducationItem(degree="B.S. Computer Science", institution="Tech University")],
        experience=[ExperienceItem(role="Software Engineer", company="Tech Corp", description="Backend APIs")],
        projects=[ProjectItem(name="API Gateway", description="High performance proxy in Go")]
    )
    dumped = profile.model_dump()
    assert dumped["name"] == "Alex Smith"
    assert len(dumped["skills"]) == 3
    assert len(dumped["projects"]) == 1
