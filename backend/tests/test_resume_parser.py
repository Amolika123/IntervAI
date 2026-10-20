import io
import pytest
from backend.app.services.resume_parser import (
    extract_github_urls_from_text,
    fallback_rule_based_parser,
    extract_text_from_pdf,
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


def test_multiple_named_projects_extraction_no_placeholders():
    resume_text = """
Amolika Verma
Machine Learning & AI Engineer | amolika@example.com | Python, PyTorch, FastAPI, ChromaDB, PostgreSQL

EDUCATION
B.S. Computer Science, University of Technology, 2024

TECHNICAL SKILLS
Languages: Python, JavaScript, TypeScript, SQL
Frameworks: PyTorch, FastAPI, React, Next.js
Databases: ChromaDB, PostgreSQL, Redis

PROJECTS
NutrInspect – AI-Powered Nutrition Analysis
• Developed an intelligent computer vision pipeline for real-time meal nutrient analysis using PyTorch.
• Deployed microservices with FastAPI processing 200+ images/minute.
GitHub: https://github.com/janedoe/nutrinspect

AI Agent for Fake News Detection
• Built a multi-agent RAG verification system using LangChain, OpenAI, and ChromaDB.
• Optimized vector indexing latency and achieved 93% accuracy on multimodal datasets.
GitHub: https://github.com/janedoe/fake-news-rag

Agentic AI Based Pharmacy System
• Engineered an autonomous prescription verification engine integrating PostgreSQL.
• Reduced order validation delays by 40% with automated constraint checking.
"""
    profile = fallback_rule_based_parser(resume_text)
    assert profile.name == "Amolika Verma"
    assert len(profile.projects) == 3

    project_names = [p.name for p in profile.projects]
    assert any("NutrInspect" in name for name in project_names)
    assert any("Fake News Detection" in name for name in project_names)
    assert any("Pharmacy System" in name for name in project_names)

    # Ensure NO generic placeholder names
    for p in profile.projects:
        assert "Primary Technical Project" not in p.name
        assert "Project 1" not in p.name
        assert len(p.description) > 10

    # Verify URLs
    nutr_proj = next(p for p in profile.projects if "NutrInspect" in p.name)
    assert nutr_proj.url == "https://github.com/janedoe/nutrinspect"

    pharmacy_proj = next(p for p in profile.projects if "Pharmacy" in p.name)
    assert pharmacy_proj.url is None, "Project without link should have url=None"


def test_resume_without_project_links():
    resume_text = """
John Doe
Senior Software Engineer | Python, React, PostgreSQL

PROJECTS
Distributed Cache Invalidator
• Architected cache synchronization service across 12 node clusters.
• Implemented heartbeat gossip protocol in Python.

Automated Log Analysis Pipeline
• Streamed Kubernetes logs to PostgreSQL with anomaly detection.
"""
    profile = fallback_rule_based_parser(resume_text)
    assert len(profile.projects) >= 2
    for p in profile.projects:
        assert p.name != "Primary Technical Project"
        assert p.url is None


def test_empty_or_unreadable_pdf_raises_error():
    empty_bytes = b""
    with pytest.raises(ValueError):
        extract_text_from_pdf(empty_bytes)

    unreadable_random_bytes = b"not a valid pdf buffer at all"
    with pytest.raises(ValueError):
        extract_text_from_pdf(unreadable_random_bytes)


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
    assert dumped["projects"][0]["name"] == "API Gateway"


def test_sequential_resume_uploads_no_context_leakage():
    resume1 = """
Alice Walker
Python, PyTorch
PROJECTS
Alpha Project
• Autonomous robotics control.
"""
    resume2 = """
Bob Builder
Java, Spring Boot
PROJECTS
Beta Construction Management
• Cloud scheduling system.
"""
    profile1 = fallback_rule_based_parser(resume1)
    profile2 = fallback_rule_based_parser(resume2)

    assert profile1.name == "Alice Walker"
    assert profile2.name == "Bob Builder"
    assert profile1.projects[0].name != profile2.projects[0].name
    assert "Alpha" in profile1.projects[0].name
    assert "Beta" in profile2.projects[0].name
    assert "Java" not in profile1.skills
    assert "PyTorch" not in profile2.skills
