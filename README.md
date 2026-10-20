# IntervAI — Resume-Grounded AI Technical Interviewer

> **"Upload your resume. IntervAI understands your projects and conducts a real-time technical voice interview about your own experience."**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-Python_SDK-412991?style=for-the-badge&logo=openai&logoColor=white)](https://platform.openai.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![SQLite](https://img.shields.io/badge/SQLite-dev.db-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

---

## 🌟 Executive Overview

**IntervAI** is a hybrid full-stack, voice-first AI technical interviewer designed to eliminate generic textbook mock interview questions. Instead of selecting broad topics like DSA, DBMS, or NLP, IntervAI inspects the candidate's actual PDF resume and publicly linked GitHub repositories (extracting `README.md` documentation and codebase file structure) to build a normalized **Candidate Context Dossier**.

The interviewer conducts a live voice conversation—speaking every question aloud and using automatic Voice Activity Detection (VAD) to listen to candidate answers through the microphone—probing system architecture, design trade-offs, edge cases, and scalability.

---

## 🏗️ Architecture: Next.js Frontend + FastAPI Python Backend

IntervAI operates as a high-performance **hybrid architecture**:

- **Frontend & Browser Layer (Next.js 16 + React 19 + TypeScript):** Handles cinematic motion UI, resume upload dropzones, company style selection cards, live audio playback, Web Speech API speech-to-text, and microphone turn detection (VAD).
- **Backend Business Logic Layer (Python 3.11+ + FastAPI + SQLAlchemy):** Authoritative server-side intelligence handling multi-strategy PDF parsing (`pypdf` + `pdfplumber`), GitHub repository inspection (`httpx`), grounded system prompt generation, company style directives, OpenAI SDK structured parsing and evaluations, TTS audio synthesis, and database operations.
- **Transparent API Proxying:** The existing Next.js API routes under `src/app/api/` act as lightweight TypeScript proxy handlers forwarding client requests to the FastAPI backend (`http://127.0.0.1:8000`), preserving all existing frontend API contracts, status codes, multipart file uploads, and binary audio streaming.
- **Database Layer (SQLite + SQLAlchemy):** Existing database contents and schema in `prisma/dev.db` are preserved without resets or data loss. SQLAlchemy models map directly to the Prisma schema using a custom `PrismaDateTime` TypeDecorator to handle integer millisecond timestamps safely.

```mermaid
flowchart TD
    subgraph Client ["Frontend Layer (Next.js 16 / React 19 / TypeScript)"]
        UI["Landing & Upload UI"]
        StyleSelector["Style Preset Selector (FAANG / MANGOS / Big 4)"]
        VoiceEngine["Voice Engine (SpeechRecognition & Audio Playback)"]
        ResultsUI["Results & Evaluation Dashboard"]
    end

    subgraph ProxyLayer ["Next.js API Proxy Handlers (src/app/api/*)"]
        P_Upload["/api/resume/upload"]
        P_Start["/api/interview/start"]
        P_Session["/api/interview/session"]
        P_Answer["/api/interview/answer"]
        P_End["/api/interview/end"]
        P_Results["/api/interview/:id/results"]
        P_TTS["/api/tts"]
    end

    subgraph BackendEngine ["Authoritative Python Backend (FastAPI / backend/app)"]
        FastAPI_Router["FastAPI Application (Port 8000)"]
        PDFParser["Resume Parser (pypdf + pdfplumber + OpenAI)"]
        GHService["GitHub Service (httpx async REST)"]
        ContextBuilder["Candidate Context Aggregator"]
        SystemPrompt["Grounded Prompt Engine (Anti-Trivia Guardrails)"]
        StylesConfig["Interview Styles Config (FAANG, MANGOS, Big 4)"]
        Evaluator["Evaluation Engine (0-100 Score & Breakdown)"]
        TTSService["TTS Audio Generator (OpenAI Audio)"]
        SQLAModels["SQLAlchemy ORM (PrismaDateTime Compatibility)"]
    end

    subgraph Storage ["Database & External Services"]
        SQLite[("SQLite Database: prisma/dev.db")]
        OpenAI["OpenAI API (GPT-4o & TTS-1)"]
        GitHub["GitHub REST API"]
    end

    UI --> P_Upload
    StyleSelector --> P_Start
    VoiceEngine --> P_Session
    VoiceEngine --> P_Answer
    VoiceEngine --> P_TTS
    VoiceEngine --> P_End
    ResultsUI --> P_Results

    P_Upload --> FastAPI_Router
    P_Start --> FastAPI_Router
    P_Session --> FastAPI_Router
    P_Answer --> FastAPI_Router
    P_End --> FastAPI_Router
    P_Results --> FastAPI_Router
    P_TTS --> FastAPI_Router

    FastAPI_Router --> PDFParser
    FastAPI_Router --> GHService
    FastAPI_Router --> ContextBuilder
    FastAPI_Router --> SystemPrompt
    FastAPI_Router --> Evaluator
    FastAPI_Router --> TTSService
    FastAPI_Router --> SQLAModels

    PDFParser <--> OpenAI
    Evaluator <--> OpenAI
    TTSService <--> OpenAI
    GHService <--> GitHub
    SQLAModels <--> SQLite
```

---

## 🚀 Key Highlights & Differentiators

* 🎯 **100% Resume-Grounded Probing:** Zero generic quiz questions. Every question directly references explicit resume claims, project descriptions, GitHub README content, or candidate responses.
* 🏢 **Selectable Company-Specific Interview Styles:** Three configurable presets (**FAANG**, **MANGOS**, **Big 4**) calibrate *how* the interviewer probes depth, architecture, and reliability, while keeping content 100% grounded in candidate experience.
* 🐙 **GitHub Repository Deep Dive:** Automatically validates public GitHub URLs, extracts repository metadata, parses `README.md`, and retrieves codebase file tree structure.
* 🎙️ **Voice-First Interactive Experience:** Speaks every question aloud via Text-to-Speech (`/api/tts` & Web Speech API) and listens through candidate microphone with automated 1.8s silence VAD turn detection.
* 📊 **Comprehensive AI Evaluation Report:** Generates an overall technical score (0–100), key strengths, areas for improvement, per-question grounded feedback, and displays the interview style preset calibration.

---

## 🛠️ Feature Deep Dive

### 1. Multi-Strategy PDF Text Extractor
Located in [`backend/app/services/resume_parser.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/services/resume_parser.py), text extraction uses a robust multi-strategy fallback hierarchy:
1. **Stage 1 (Primary):** `pypdf` fast stream reader.
2. **Stage 2 (Secondary):** `pdfplumber` layout-aware text extractor for complex PDF documents.
3. **Stage 3 (Tertiary):** Raw regex-based text stream extraction.
4. **Structured Profile Parsing:** Extracted text is transformed into a structured candidate profile using OpenAI structured outputs (`gpt-4o`) with fallback to a deterministic rule-based extractor.

### 2. GitHub Public Repository Inspection Matrix
Located in [`backend/app/services/github_service.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/services/github_service.py):
- Validates GitHub URLs and extracts repository owner & name.
- Retrieves `README.md` and strips raw HTML comments/badges to fit into context window.
- Fetches directory tree (`git/trees`) for file structure context using async `httpx`.
- Fallback hierarchy: `resume+github_readme` $\rightarrow$ `resume+github_tree` $\rightarrow$ `resume_only`. Inaccessible or missing repositories safely fall back without hallucinating repository information.

### 3. Voice Engine & Turn Detection (VAD)
Located in [`src/lib/voice/speechEngine.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/voice/speechEngine.ts):
- **Audio Output:** Plays spoken question aloud via `/api/tts` (OpenAI `tts-1` `alloy` voice) or client Web Speech API (`window.speechSynthesis`).
- **Microphone Input:** SpeechRecognition STT capturing candidate answer in real-time.
- **VAD Turn Detection:** 1.8 seconds of silence after candidate speaks automatically finalizes transcript, transitions state to `PROCESSING_ANSWER`, and submits to backend.

### 4. High-Fidelity PDF Parsing & Multi-Project Extraction Engine
Located in [`backend/app/services/resume_parser.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/services/resume_parser.py):
- **Hyperlink Annotation Extraction:** Extracts embedded PDF hyperlinks (`/Annots` with `/Subtype /Link` and `/URI` actions via `pypdf`, plus `pdfplumber.hyperlinks`) so that clickable text in resumes (e.g. project titles linking to GitHub repositories) is resolved into valid URLs even if the printed text does not spell out the full URL.
- **Strict Anti-Placeholder Rules:** Explicitly forbids generic fallback strings such as "Primary Technical Project", "Project 1", or "Project 2". If a candidate worked on *NutrInspect – AI-Powered Nutrition Analysis*, *AI Agent for Fake News Detection*, or *Agentic AI Based Pharmacy System*, the exact project names and descriptions are preserved.
- **Multi-Project Boundary Segmentation:** Uses rule-based segmentation as an immediate fallback or pre-processor that identifies distinct project headers, associated technology tags, descriptions, and repository URLs without merging multiple projects into a single record.
- **Strict Isolation & Anti-Leakage:** Ensures each upload assigns a brand-new `resumeId` and candidate context. Prevents stale candidate data or cached context from a previous upload from leaking across sessions.

### 5. Fresh Question Bank Generation & Anti-Repetition Engine
Located in [`backend/app/services/question_bank.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/services/question_bank.py):
- **Interview-Specific Question Bank (8–12 Questions):** When an interview begins, a brand-new, isolated question bank is generated in the `InterviewPlannedQuestion` table. Questions are grounded in the candidate's actual projects, technologies, and experience, calibrated to the selected company style (FAANG, MANGOS, Big 4).
- **Personalized First Question:** Eliminates generic greetings. The AI opens immediately with a technical discussion addressing the candidate by name and probing the implementation mechanics of their actual project.
- **Two-Tier Anti-Repetition Engine:**
  1. *Exact & Token Overlap Detection:* Normalizes question text (punctuation, casing, whitespace) and computes token Jaccard similarity to reject exact or near-exact re-asks.
  2. *Semantic Duplicate Detection:* Extracts question intent (e.g., `CHOICE_OR_SELECTION`, `ARCHITECTURE`, `FAILURE_HANDLING`) and technical entities (e.g. `ChromaDB`, `PyTorch`, `FastAPI`). If a question shares the same intent and technical subject without a meaningful change in context, it is rejected as a duplicate:
     - *"What was the reason for choosing ChromaDB?"*
     - *"Why did you select ChromaDB?"*
     - *"Why did you decide to use ChromaDB?"*
     All three are classified as duplicates of the same inquiry.
  3. *Valid Progression Allowed:* Legitimate technical progressions (e.g. from ChromaDB vector indexing architecture to query retry failure handling under upstream timeouts) are preserved because their underlying intent and evaluation criteria differ.

### 6. Question Bank Lifecycle & Safe Data Cleanup
Located in [`backend/app/db/models.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/db/models.py) and [`backend/app/api/interviews.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/api/interviews.py):
The question bank represents temporary interview-planning data. It is decoupled from permanent interview history:
- **Temporary Planning Table:** `InterviewPlannedQuestion` holds planned questions for the active session.
- **Permanent History Tables:** `InterviewQuestion`, `InterviewAnswer`, and `Evaluation` permanently retain the questions actually asked, candidate transcripts, audio timing, evaluation scores, and feedback.
- **Lifecycle Progression:**
  ```text
  Interview Starts (POST /api/interview/start)
    └── Generates fresh temporary bank (8-12 questions in InterviewPlannedQuestion)
  Interview In Progress (POST /api/interview/answer)
    └── Marks planned question as asked (isAsked = True); persists turn in InterviewQuestion/InterviewAnswer
  Candidate Ends Interview (POST /api/interview/end)
    └── Computes and persists Evaluation report
  Results Page Loaded (GET /api/interview/:id/results or POST /api/interview/:id/cleanup)
    └── Purges temporary InterviewPlannedQuestion records for this interview
    └── Permanent history (InterviewQuestion, InterviewAnswer, Evaluation) remains 100% intact
  ```
- **Idempotency & Reopening:** The cleanup operation is completely idempotent and safe to retry. Refreshing or reopening `/results/[id]` continues to display the complete transcript, evaluation report, and feedback scores.

### 7. Selectable Company-Specific Technical Interview Styles
Configured centrally in [`backend/app/config/interview_styles.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/config/interview_styles.py) and presentationally mirrored in [`src/lib/interviewer/styles.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/interviewer/styles.ts):
After resume analysis and before the interview begins, the candidate selects their desired interview style preset. The selection dictates **how** the AI probes, while the candidate's resume and GitHub projects dictate **what** is asked:

| Preset | Companies Included | Focus & Probing Emphasis | Example Grounded Question Angle (e.g., RAG Project) |
| :--- | :--- | :--- | :--- |
| **FAANG** | Meta, Amazon, Apple, Netflix, Google | Technical depth, algorithmic complexity, memory/runtime efficiency, low-level mechanics, boundary edge cases. | Chunking algorithm complexity, vector index runtime bounds, retrieval latency, boundary input handling. |
| **MANGOS** | Meta, Anthropic, NVIDIA, Google, OpenAI, SpaceX | Deep technical reasoning, AI/ML concepts, distributed system architecture, failure scenarios, performance trade-offs. | Embedding model trade-offs, vector DB scaling bottlenecks, pipeline failure modes under upstream timeouts. |
| **Big 4** | Deloitte, PwC, EY, KPMG | Practical software engineering, database schemas & indexing, API contracts, error handling, production debugging, reliability. | Relational database modeling, query indexing, API schema contracts, production logging, data consistency. |

* **Strict Grounding:** Candidates never select an isolated topic. No HR or behavioral questions are introduced; all three styles remain strictly technical.
* **Session Persistence:** The selected style is stored in the database (`Interview.style`), persists across session reconnects, guides dynamic follow-up evaluations, and appears in the final evaluation report.

### 8. Cinematic Motion Landing Page & Visual Identity
Designed to deliver a premium, futuristic AI technology aesthetic rather than a generic recruitment board:
* **Color Palette & Tokens:** Defined in [`src/app/globals.css`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/app/globals.css) via HSL variables: Background `260 87% 3%`, Foreground `40 6% 95%`, Secondary `40 6% 82%`, and multi-stop accents (Indigo `#6366f1`, Violet `#a855f7`, Cyan `#22d3ee`).
* **Typography:** General Sans for bold, fluid headlines (`clamp(3rem, 7.5vw, 6rem)` with letter spacing `-0.035em` and line height `1.02`), paired with Geist Sans for clear body text.
* **Full-Viewport Video Background:** Full-viewport hero (`min-height: 100svh`) with looping video background powered by a `requestAnimationFrame` controller (smooth 0.5s fade-in, 0.5s fade-out near loop end, 100ms reset cycle, and fallback for `prefers-reduced-motion`).
* **Centered Headline Backdrop Blur:** Separate centered blurred shape (`.hero-headline-backdrop` with `backdrop-filter: blur(36px)`) behind the headline ensuring contrast without applying a full gradient overlay on top of the video.
* **Capabilities Marquee:** Pinned near the bottom of the hero with a fixed `"BUILT AROUND YOUR EXPERIENCE"` badge and a seamless 20s infinite loop of product capability tiles with abstract symbols.
* **Liquid Glass Effect:** Reusable `.liquid-glass` utility class featuring translucent surfaces, backdrop blur, inset highlights, and hover transitions.
* **Below-the-Fold Exploration:** Modular sections for `#how-it-works` (6-step pipeline), `#interview-styles` (FAANG, MANGOS, Big 4 cards), and `#features` (architectural differentiators), leading into the resume upload flow.

---

## 🗄️ Database Layer (SQLite via SQLAlchemy)

The application uses the existing SQLite database at `prisma/dev.db`. The database contents, existing records, and schema are preserved completely.

Python database access is implemented in:
- [`backend/app/db/session.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/db/session.py): SQLAlchemy engine and session management. Automatically converts Prisma's `file:./dev.db` format to an absolute `sqlite:///...` path.
- [`backend/app/db/models.py`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/db/models.py): Accurate SQLAlchemy mappings for all tables (`User`, `Resume`, `Project`, `ProjectSource`, `Interview`, `InterviewQuestion`, `InterviewAnswer`, `Evaluation`, and `InterviewPlannedQuestion`). Includes a custom `PrismaDateTime` TypeDecorator that transparently converts Prisma's integer millisecond epoch timestamps to Python `datetime` objects.

```
+----------------+       1:N       +----------------+       1:N       +-----------------+
|      User      | --------------->|     Resume     | --------------->|     Project     |
+----------------+                 +----------------+                 +-----------------+
        |                                  |                                   |
        | 1:N                              | 1:N                               | 1:N
        v                                  v                                   v
+----------------+                 +----------------+                 +-----------------+
|   Interview    |<----------------| ProjectSource  |                 |InterviewQuestion|
| (style: FAANG) |                 +----------------+                 +-----------------+
+----------------+                                                             |
  |   |        |                                                               | 1:1
  |   | 1:1    | 1:N                                                           v
  |   v        v                                                      +-----------------+
  | +----+  +---------------+                                         | InterviewAnswer |
  | |Eval|  |InterviewAnswer|<----------------------------------------+-----------------+
  | +----+  +---------------+
  |
  | 1:N (Temporary Planning Bank - purged after results load)
  v
+--------------------------+
| InterviewPlannedQuestion |
+--------------------------+
```

---

## 🔌 API Map Reference

All API routes preserve their exact URLs, request payloads, response bodies, and HTTP status codes:

| Endpoint | Method | Python Destination | Description |
| :--- | :--- | :--- | :--- |
| `/api/resume/upload` | `POST` | `backend/app/api/resume.py` | Multipart PDF resume upload, hyperlink annotation extraction, OpenAI profile parsing, GitHub inspection, SQLite persistence. |
| `/api/resume/[id]` | `GET` | `backend/app/api/resume.py` | Retrieves structured candidate profile and context dossier for a specific resume. |
| `/api/interview/start` | `POST` | `backend/app/api/interviews.py` | Accepts `{ resumeId, style }`, generates fresh 8-12 question bank, and initializes `Interview` record. |
| `/api/interview/session` | `POST` | `backend/app/api/interviews.py` | Accepts `{ interviewId }`, returns session configuration, style instructions, and personalized opening question. |
| `/api/interview/answer` | `POST` | `backend/app/api/interviews.py` | Accepts `{ interviewId, order, questionText, groundingSource, transcript, projectId }`, stores turn, and returns next question. |
| `/api/interview/end` | `POST` | `backend/app/api/interviews.py` | Accepts `{ interviewId }`, triggers AI evaluation engine, calculates overall score and strengths/improvements. |
| `/api/interview/[id]/results` | `GET` | `backend/app/api/interviews.py` | Retrieves overall score, style preset, candidate details, projects, question breakdown, transcript, and purges temporary bank. |
| `/api/interview/[id]/cleanup` | `POST` | `backend/app/api/interviews.py` | Idempotent manual trigger to delete temporary planned questions after results have loaded. |
| `/api/tts` | `POST` | `backend/app/api/tts.py` | Accepts `{ text }`, generates binary `audio/mpeg` MP3 stream using OpenAI TTS (or returns `{ fallback: true }`). |

---

## 📂 Project Structure

```
IntervAI/
├── backend/                               # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI application entrypoint & CORS
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── resume.py                 # POST /api/resume/upload
│   │   │   ├── interviews.py             # /start, /session, /answer, /end, /:id/results
│   │   │   └── tts.py                    # POST /api/tts
│   │   ├── config/
│   │   │   ├── __init__.py
│   │   │   ├── settings.py               # Environment & SQLite path configuration
│   │   │   └── interview_styles.py       # FAANG, MANGOS, Big 4 preset definitions
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py                # SQLAlchemy session & engine factory
│   │   │   └── models.py                 # SQLAlchemy ORM models with PrismaDateTime
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── resume.py                 # Pydantic schemas for resume upload
│   │   │   ├── interview.py              # Pydantic schemas for interview lifecycle
│   │   │   └── evaluation.py             # Pydantic schemas for evaluation results
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── resume_parser.py          # PDF text extraction & structured parsing
│   │       ├── github_service.py         # httpx GitHub README & file-tree retrieval
│   │       ├── candidate_context_builder.py # Context dossier compiler
│   │       ├── system_prompt.py          # Grounded interviewer prompt generator
│   │       ├── evaluator.py              # AI evaluation & scoring service
│   │       └── tts_service.py            # OpenAI TTS audio generation
│   ├── tests/                            # Comprehensive Python Test Suite
│   │   ├── __init__.py
│   │   ├── test_context_and_prompts.py   # Grounding & style directives tests
│   │   ├── test_db_and_api.py            # SQLite reads/writes & full API lifecycle tests
│   │   ├── test_github_service.py        # GitHub URL parsing & README sanitizer tests
│   │   └── test_resume_parser.py         # PDF parser & schema tests
│   ├── requirements.txt                  # Python dependencies
│   └── .env.example                      # Environment variables example for Python
├── prisma/
│   ├── schema.prisma                     # Prisma Schema Reference
│   └── dev.db                            # SQLite Database (Preserved)
├── src/
│   ├── app/
│   │   ├── api/                          # Next.js TypeScript Proxy Routes
│   │   │   ├── resume/upload/route.ts    # Proxies to FastAPI /api/resume/upload
│   │   │   ├── interview/start/route.ts  # Proxies to FastAPI /api/interview/start
│   │   │   ├── interview/session/route.ts# Proxies to FastAPI /api/interview/session
│   │   │   ├── interview/answer/route.ts # Proxies to FastAPI /api/interview/answer
│   │   │   ├── interview/end/route.ts    # Proxies to FastAPI /api/interview/end
│   │   │   ├── interview/[id]/results/route.ts # Proxies to FastAPI /api/interview/:id/results
│   │   │   └── tts/route.ts              # Proxies to FastAPI /api/tts (audio/mpeg)
│   │   ├── interview/[id]/page.tsx       # Live Voice Interview Screen
│   │   ├── processing/[id]/page.tsx      # Context Processing & Style Selection Screen
│   │   ├── results/[id]/page.tsx         # Assessment & Report Screen
│   │   ├── globals.css                   # Dark Mode & Glassmorphism Design System
│   │   ├── layout.tsx                    # Root Application Layout
│   │   └── page.tsx                      # Landing Page & Resume Upload Dropzone
│   └── lib/
│       ├── interviewer/
│       │   └── styles.ts                 # Presentation Style Configurations for UI
│       └── voice/
│           └── speechEngine.ts           # Browser SpeechRecognition & Web Speech VAD
├── scripts/
│   ├── test_runner.ts                    # Backend Integrity Test Suite Runner
│   ├── test_style_flow.ts                # End-to-End Style Flow Integration Test
│   └── verify_landing.ts                 # Landing Page Verification Test
├── package.json                          # npm scripts & dependencies
└── README.md                             # Detailed System Documentation
```

---

## ⚡ Local Setup & Installation

### Prerequisites
* **Node.js:** v20.x or higher
* **Python:** v3.11 or higher
* **Package Managers:** `npm` and `pip`

---

### 1. Python Backend Setup

1. **Create and activate a virtual environment:**
   ```bash
   # On Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # On macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

---

### 2. Frontend Setup

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

---

### 3. Environment Variables Configuration

Create a `.env` (or `.env.local`) file in the root directory:

```env
# Database Connection (SQLite local path)
DATABASE_URL="file:./dev.db"

# Python FastAPI Base URL for Next.js Proxies
PYTHON_API_BASE_URL="http://127.0.0.1:8000"

# OpenAI API Key (Required for structured NLP, TTS audio & Evaluation)
OPENAI_API_KEY="your-openai-api-key-here"

# GitHub Token (Optional: Increases GitHub REST API rate limits)
GITHUB_TOKEN="your-github-personal-access-token"
```

---

### 4. Running the Application

You have two options for running the development environment:

#### Option A: Run Both Concurrently (Recommended)
```bash
npm run dev:all
```
This launches the FastAPI server on `http://127.0.0.1:8000` and the Next.js frontend on `http://localhost:3000` simultaneously in a single terminal with colored logs.

#### Option B: Run in Separate Terminals
1. **Terminal 1 (Python FastAPI Backend):**
   ```bash
   npm run dev:backend
   # Or directly:
   uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Terminal 2 (Next.js Frontend):**
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

---

## ⏱️ Dual Interview Timers & Timing Safeguards

IntervAI features a centralized, drift-free dual timer system configured centrally in [backend/app/config/interview_config.py](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/backend/app/config/interview_config.py) and [src/lib/interviewer/interviewConfig.ts](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/interviewer/interviewConfig.ts):

| Timer Dimension | Default Limit | Warning Threshold 1 | Warning Threshold 2 | Warning Threshold 3 | Trigger Condition | Expiration Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Total Interview Countdown** | **40 Minutes** (2400s) | **5 Minutes** (300s, amber alert) | **1 Minute** (60s, amber alert) | **10 Seconds** (urgent red pulse) | Starts *only* after user clicks "Start Voice Session Now" & mic is granted | Stops capture, finalizes in-progress speech, closes interview, generates deterministic evaluation, and navigates to results |
| **Per-Question Answer Countdown** | **90 Seconds** (90s) | **15 Seconds** (amber badge) | **5 Seconds** (red urgent highlight) | — | Starts *after* the AI finishes speaking the question aloud (`onAISpeechEnd`) | Finalizes answer with status `timed_out` (0 score if no speech), advances to next grounded question |

### Key Timing Safeguards
- **Interviewer Speech Exemption:** The candidate's 90-second answer timer does **not** run while the AI interviewer is synthesizing or speaking the question. Timer starts only on `onAISpeechEnd`.
- **Drift-Free Timestamp Calculation:** Countdowns are computed against absolute deadline timestamps (`Date.now() + durationMs`), preventing drift from interval delays or component re-renders.
- **Double-Submission Guard:** Concurrent submissions from simultaneous manual click and timer expiration are protected via client-side `isSubmittingRef` / `isEndingRef` flags and backend endpoint idempotency.

---

## 🎯 Deterministic Evaluation Engine & Rubric Calibration

### Root-Cause Resolution for Inflated Scores
Historically, candidates could receive ~80/100 even after remaining completely silent because:
1. `save_answer` strictly required `transcript`, causing silent turns to be rejected and 0 turns persisted.
2. `end_interview` invoked fallback evaluator with 0 turns, which hardcoded `80/100` and hallucinated a fake ChromaDB question.
3. The results frontend defaulted missing evaluation scores to `?? 85`.

### Strict Deterministic Rubric
Scores are calculated deterministically in the Python backend using transparent, weighted rubric dimensions:

$$\text{Question Score} = (\text{Technical Correctness} \times 0.40) + (\text{Completeness} \times 0.25) + (\text{Depth} \times 0.20) + (\text{Relevance} \times 0.15)$$

- **Silence & Filler Detection:** Transcripts containing whitespace, silence (`[silence]`), or filler words (`um`, `uh`, `hmm`, `like`) are automatically flagged as non-assessable.
- **Zero-Score for Unanswered Turns:** Any turn with status `unanswered`, `timed_out`, or empty transcript receives **0.0 across all 4 dimensions**.
- **Deterministic Overall Score:** Calculated strictly as the average of all asked questions. A model-generated overall score is never allowed to override backend calculation.
- **Insufficient Evidence Assessment:** If all answers are empty or unanswered, IntervAI outputs **0/100** with the official assessment:
  > *"Insufficient evidence to assess technical ability. No valid answers were recorded."*
- **Persisted Question Breakdown:** Results dashboard displays the exact per-question rubric scores (Correctness, Completeness, Depth, Relevance), status badges (`Answered`, `Timed Out`, `Unanswered`, `Audio Failed`), evaluator feedback, and suggested improvements.

---

## 🧪 Testing & Verification

### 1. Python Backend Test Suite (32 Tests, 100% Pass Rate)
Run the 32 comprehensive unit and integration tests:

```bash
npm run test
# Or directly:
python -m pytest backend/tests -v
```

**Test Coverage Breakdown:**
- `backend/tests/test_evaluation_and_timing.py` (11 Tests): Centralized timing configuration constants (40m/90s with 5m, 1m & 10s warnings), rubric weight verification (40/25/20/15), silence & filler detection, unanswered & timed out zero-scoring, all-empty turns receiving 0/100 and `INSUFFICIENT_EVIDENCE_ASSESSMENT`, all-timed-out receiving 0/100, deterministic overall score averaging with 0-score penalty, elimination of hardcoded 80/100 fallback, `/api/interview/answer` timed out turn persistence, and `end_interview` idempotency.
- `backend/tests/test_resume_parser.py` (6 Tests): Multi-project extraction with real names (*NutrInspect*, *Fake News Detection*, *Pharmacy System*), clickable PDF hyperlink annotations (`/Annots` -> `/URI`), printed GitHub URLs, links-free resumes, unreadable/empty PDF validation, sequential upload anti-leakage isolation, and Pydantic schema validation.
- `backend/tests/test_question_bank_and_lifecycle.py` (4 Tests): Deterministic and dynamic question bank generation (8–12 questions), depth calibration for FAANG/MANGOS/Big 4, exact and token-level duplicate prevention, semantic intent & technical entity duplicate rejection (e.g. ChromaDB phrasing variants), independent question banks per interview, and question bank lifecycle with automatic cleanup upon results loading while preserving asked questions and evaluation history.
- `backend/tests/test_context_and_prompts.py` (2 Tests): Candidate context building and style-grounded system prompts.
- `backend/tests/test_github_service.py` (5 Tests): URL sanitization, README retrieval, and inaccessible repository fallback.
- `backend/tests/test_db_and_api.py` (4 Tests): SQLite reads/writes, full API workflow lifecycle, and TTS generation.

### 2. Production Build Verification
Verify Next.js production build and TypeScript compilation:

```bash
npm run build
```

---

## 📄 License & Attribution

Developed for **IntervAI** — Resume-Grounded AI Technical Interviewer.
