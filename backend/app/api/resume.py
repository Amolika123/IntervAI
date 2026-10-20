import json
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.db.models import User, Resume, Project, ProjectSource
from backend.app.services.resume_parser import extract_text_from_pdf, parse_resume_text_with_nlp
from backend.app.services.candidate_context_builder import build_candidate_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/resume", tags=["resume"])


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="No PDF file uploaded.")

        filename_lower = file.filename.lower()
        if not filename_lower.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF resumes are accepted."
            )

        content = await file.read()

        # Check size limit (max 10MB)
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 10MB limit.")

        # 1. Extract raw text from PDF
        try:
            raw_text = extract_text_from_pdf(content)
        except Exception as e:
            logger.error(f"Failed to extract text from PDF: {e}")
            raise HTTPException(
                status_code=422,
                detail="Unable to extract text from PDF. Please upload a readable text-based PDF."
            )

        if not raw_text or len(raw_text.strip()) < 20:
            raise HTTPException(
                status_code=422,
                detail="Unable to extract text from PDF. Please upload a readable text-based PDF."
            )

        # 2. Structured NLP parsing
        parsed_profile = await parse_resume_text_with_nlp(raw_text)

        # 3. Build candidate context & fetch GitHub public repository details
        candidate_context = await build_candidate_context(parsed_profile)

        # 4. Create Database Records
        user = User()
        db.add(user)
        db.flush()

        resume = Resume(
            userId=user.id,
            fileName=file.filename,
            rawText=raw_text,
            parsedProfile=json.dumps(parsed_profile.model_dump())
        )
        db.add(resume)
        db.flush()

        stored_projects = []
        for proj in candidate_context.projects:
            db_proj = Project(
                resumeId=resume.id,
                name=proj.name,
                resumeDescription=proj.resumeDescription,
                githubUrl=proj.githubUrl,
                githubOwner=proj.githubOwner,
                githubRepo=proj.githubRepo,
                repositoryAccessible=proj.repositoryAccessible,
                readmeAvailable=proj.readmeAvailable,
                contextSource=proj.contextSource
            )
            db.add(db_proj)
            db.flush()

            if proj.readmeText:
                source_readme = ProjectSource(
                    projectId=db_proj.id,
                    sourceType="README",
                    content=proj.readmeText
                )
                db.add(source_readme)

            if proj.repositoryStructure:
                source_tree = ProjectSource(
                    projectId=db_proj.id,
                    sourceType="FILE_TREE",
                    content=json.dumps(proj.repositoryStructure)
                )
                db.add(source_tree)

            p_dict = proj.model_dump()
            p_dict["id"] = db_proj.id
            stored_projects.append(p_dict)

        db.commit()

        context_dict = candidate_context.model_dump()
        context_dict["projects"] = stored_projects

        return {
            "success": True,
            "userId": user.id,
            "resumeId": resume.id,
            "parsedProfile": parsed_profile.model_dump(),
            "candidateContext": context_dict
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        logger.error(f"Resume upload endpoint error: {error}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/{resume_id}")
async def get_resume_by_id(
    resume_id: str,
    db: Session = Depends(get_db)
):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    parsed_profile = json.loads(resume.parsedProfile)
    projects_list = []
    for p in resume.projects:
        projects_list.append({
            "id": p.id,
            "name": p.name,
            "resumeDescription": p.resumeDescription,
            "githubUrl": p.githubUrl,
            "githubOwner": p.githubOwner,
            "githubRepo": p.githubRepo,
            "repositoryAccessible": p.repositoryAccessible,
            "readmeAvailable": p.readmeAvailable,
            "contextSource": p.contextSource,
        })

    return {
        "success": True,
        "resumeId": resume.id,
        "userId": resume.userId,
        "parsedProfile": parsed_profile,
        "candidateContext": {
            "candidate": {
                "name": parsed_profile.get("name", "Candidate"),
                "education": parsed_profile.get("education", []),
                "skills": parsed_profile.get("skills", []),
                "technologies": parsed_profile.get("technologies", []),
                "experience": parsed_profile.get("experience", []),
            },
            "projects": projects_list,
        }
    }

