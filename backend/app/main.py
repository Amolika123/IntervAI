import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config.settings import settings
from backend.app.api import resume_router, interview_router, tts_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("intervai-backend")

app = FastAPI(
    title="IntervAI Backend API",
    description="Python FastAPI backend powering resume parsing, GitHub deep-dive, grounded voice interviews, and AI evaluation.",
    version="2.0.0"
)

# Enable CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(resume_router)
app.include_router(interview_router)
app.include_router(tts_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "IntervAI Backend",
        "database": settings.sqlalchemy_database_url
    }


if __name__ == "__main__":
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
