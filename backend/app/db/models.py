import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    Boolean,
    ForeignKey,
    Text,
)
from sqlalchemy.types import TypeDecorator
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


class PrismaDateTime(TypeDecorator):
    """
    Custom TypeDecorator that seamlessly interoperates with Prisma's SQLite DateTime
    storage (which stores timestamps as millisecond epoch integers).
    """
    impl = Integer
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, datetime):
            return int(value.timestamp() * 1000)
        if isinstance(value, str):
            try:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return int(dt.timestamp() * 1000)
            except Exception:
                try:
                    return int(value)
                except Exception:
                    return int(datetime.utcnow().timestamp() * 1000)
        return value

    def process_result_value(self, value, dialect) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, int):
            return datetime.utcfromtimestamp(value / 1000.0)
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except Exception:
                try:
                    return datetime.utcfromtimestamp(int(value) / 1000.0)
                except Exception:
                    return None
        if isinstance(value, datetime):
            return value
        return None


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "User"

    id = Column(String, primary_key=True, default=generate_uuid)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)
    updatedAt = Column(PrismaDateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    resumes = relationship("Resume", back_populates="user", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="user", cascade="all, delete-orphan")


class Resume(Base):
    __tablename__ = "Resume"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    fileName = Column(String, nullable=False)
    rawText = Column(Text, nullable=False)
    parsedProfile = Column(Text, nullable=False)  # Stored as JSON string
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="resumes")
    projects = relationship("Project", back_populates="resume", cascade="all, delete-orphan")
    interviews = relationship("Interview", back_populates="resume", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "Project"

    id = Column(String, primary_key=True, default=generate_uuid)
    resumeId = Column(String, ForeignKey("Resume.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    resumeDescription = Column(Text, nullable=False)
    githubUrl = Column(String, nullable=True)
    githubOwner = Column(String, nullable=True)
    githubRepo = Column(String, nullable=True)
    repositoryAccessible = Column(Boolean, default=False, nullable=False)
    readmeAvailable = Column(Boolean, default=False, nullable=False)
    contextSource = Column(String, nullable=False)  # "resume+github_readme", "resume+github_tree", "resume_only"
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    resume = relationship("Resume", back_populates="projects")
    sources = relationship("ProjectSource", back_populates="project", cascade="all, delete-orphan")
    questions = relationship("InterviewQuestion", back_populates="project")


class ProjectSource(Base):
    __tablename__ = "ProjectSource"

    id = Column(String, primary_key=True, default=generate_uuid)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    sourceType = Column(String, nullable=False)  # "README", "FILE_TREE", "RESUME_TEXT"
    content = Column(Text, nullable=False)
    retrievedAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="sources")


class Interview(Base):
    __tablename__ = "Interview"

    id = Column(String, primary_key=True, default=generate_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    resumeId = Column(String, ForeignKey("Resume.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False)  # "CREATED", "IN_PROGRESS", "COMPLETED", "FAILED"
    contextVersion = Column(String, default="v1", nullable=False)
    candidateContext = Column(Text, nullable=False)  # JSON string
    style = Column(String, default="FAANG", nullable=False)  # "FAANG", "MANGOS", "BIG_4"
    startedAt = Column(PrismaDateTime, nullable=True)
    endedAt = Column(PrismaDateTime, nullable=True)
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="interviews")
    resume = relationship("Resume", back_populates="interviews")
    questions = relationship("InterviewQuestion", back_populates="interview", cascade="all, delete-orphan", order_by="InterviewQuestion.order")
    answers = relationship("InterviewAnswer", back_populates="interview", cascade="all, delete-orphan")
    evaluation = relationship("Evaluation", back_populates="interview", uselist=False, cascade="all, delete-orphan")


class InterviewQuestion(Base):
    __tablename__ = "InterviewQuestion"

    id = Column(String, primary_key=True, default=generate_uuid)
    interviewId = Column(String, ForeignKey("Interview.id", ondelete="CASCADE"), nullable=False)
    projectId = Column(String, ForeignKey("Project.id", ondelete="SET NULL"), nullable=True)
    order = Column(Integer, nullable=False)
    questionText = Column(Text, nullable=False)
    groundingSource = Column(String, nullable=False)  # e.g. "project:FakeNewsDetection:README"
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    interview = relationship("Interview", back_populates="questions")
    project = relationship("Project", back_populates="questions")
    answer = relationship("InterviewAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class InterviewAnswer(Base):
    __tablename__ = "InterviewAnswer"

    id = Column(String, primary_key=True, default=generate_uuid)
    interviewId = Column(String, ForeignKey("Interview.id", ondelete="CASCADE"), nullable=False)
    questionId = Column(String, ForeignKey("InterviewQuestion.id", ondelete="CASCADE"), unique=True, nullable=False)
    transcript = Column(Text, nullable=False)
    evaluation = Column(Text, nullable=True)  # JSON string
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    interview = relationship("Interview", back_populates="answers")
    question = relationship("InterviewQuestion", back_populates="answer")


class Evaluation(Base):
    __tablename__ = "Evaluation"

    id = Column(String, primary_key=True, default=generate_uuid)
    interviewId = Column(String, ForeignKey("Interview.id", ondelete="CASCADE"), unique=True, nullable=False)
    overallScore = Column(Integer, nullable=False)  # 0 to 100
    overallAssessment = Column(Text, nullable=False)
    strengths = Column(Text, nullable=False)  # JSON string array
    areasToImprove = Column(Text, nullable=False)  # JSON string array
    questionBreakdown = Column(Text, nullable=False)  # JSON string array
    createdAt = Column(PrismaDateTime, default=datetime.utcnow, nullable=False)

    interview = relationship("Interview", back_populates="evaluation")
