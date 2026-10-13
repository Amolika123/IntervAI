# IntervAI — Resume-Grounded AI Technical Interviewer

> **"Upload your resume. IntervAI understands your projects and conducts a real-time technical voice interview about your own experience."**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o%20%7C%20Realtime-412991?style=for-the-badge&logo=openai&logoColor=white)](https://platform.openai.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![GitHub API](https://img.shields.io/badge/GitHub-REST_API-181717?style=for-the-badge&logo=github&logoColor=white)](https://docs.github.com/en/rest)

---

## 🌟 Executive Overview

**IntervAI** is a full-stack, voice-first AI technical interviewer designed to eliminate generic textbook mock interview questions. Instead of selecting broad topics like DSA, DBMS, or NLP, IntervAI inspects the candidate's actual PDF resume and publicly linked GitHub repositories (extracting `README.md` documentation and codebase file structure) to build a normalized **Candidate Context Dossier**.

The interviewer conducts a live voice conversation—speaking every question aloud and using automatic Voice Activity Detection (VAD) to listen to candidate answers through the microphone—probing system architecture, design trade-offs, edge cases, and scalability.

---

## 🚀 Key Highlights & Differentiators

* 🎯 **100% Resume-Grounded Probing:** Zero generic quiz questions. Every question directly references explicit resume claims, project descriptions, GitHub README content, or candidate responses.
* 🏢 **Selectable Company-Specific Interview Styles:** Three configurable presets (**FAANG**, **MANGOS**, **Big 4**) calibrate *how* the interviewer probes depth, architecture, and reliability, while keeping content 100% grounded in candidate experience.
* 🐙 **GitHub Repository Deep Dive:** Automatically validates public GitHub URLs, extracts repository metadata, parses `README.md`, and retrieves codebase file tree structure.
* 🎙️ **Voice-First Interactive Experience:** Speaks every question aloud via Text-to-Speech (`/api/tts` & Web Speech API) and listens through candidate microphone with automated 1.8s silence VAD turn detection.
* 📊 **Comprehensive AI Evaluation Report:** Generates an overall technical score (0–100), key strengths, areas for improvement, per-question grounded feedback, and displays the interview style preset calibration.

---

## 📐 System Architecture & Flow

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js React Frontend)"]
        Landing["Landing Page (PDF Upload Dropzone)"]
        Processing["Processing View (Context Aggregation)"]
        StyleSelector["Interview Style Preset Selector (FAANG / MANGOS / Big 4)"]
        VoiceUI["Live Technical Voice Interview (Audio TTS + Mic VAD)"]
        ResultsUI["Evaluation Report & Score Dashboard (Style Badge & Analysis)"]
    end

    subgraph CoreEngine ["Backend Engine Services"]
        PDFExtract["Multi-Strategy PDF Extractor (unpdf + pdf-parse + raw stream)"]
        NLPParser["OpenAI Structured NLP Profile Parser"]
        GHService["GitHub REST API Inspector (README + Repo Tree)"]
        ContextAggregator["Candidate Context Aggregator"]
        StyleConfig["Configurable Interview Presets (INTERVIEW_STYLES)"]
        GroundedPrompt["Grounded System Prompt Generator (Context + Style Directives)"]
        VoiceEngine["Audio TTS & Web Speech VAD Engine"]
        EvalEngine["AI Technical Evaluator Engine"]
    end

    subgraph DataStorage ["Data & APIs"]
        OpenAI["OpenAI API (GPT-4o & TTS)"]
        GitHub["GitHub REST API"]
        DB[("Database (Prisma / SQLite: dev.db)")]
    end

    Landing -->|PDF Resume Upload| PDFExtract
    PDFExtract --> NLPParser
    NLPParser <-->|Structured JSON Schema| OpenAI
    NLPParser --> GHService
    GHService <-->|Public Repos & README| GitHub
    GHService & NLPParser --> ContextAggregator
    ContextAggregator --> DB
    ContextAggregator --> Processing

    Processing --> StyleSelector
    StyleSelector -->|Selected Style Preset| DB
    StyleSelector --> VoiceUI

    VoiceUI <-->|Audio TTS & Mic VAD| VoiceEngine
    VoiceEngine <-->|Synthesize Spoken Audio| OpenAI
    VoiceUI -->|Persist Spoken Turns| DB

    VoiceUI -->|End Interview| EvalEngine
    EvalEngine <-->|Generate Score & Feedback| OpenAI
    EvalEngine --> DB
    EvalEngine --> ResultsUI
```

---

## 🛠️ Feature Deep Dive

### 1. Multi-Strategy PDF Text Extractor
Located in [`src/lib/nlp/resumeParser.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/nlp/resumeParser.ts), text extraction uses a 3-tier fallback hierarchy ensuring 100% extraction reliability across all PDF versions:
1. **Stage 1 (Primary):** `unpdf` (Modern PDF.js engine without native canvas bindings).
2. **Stage 2 (Secondary):** `pdf-parse/lib/pdf-parse.js` direct engine fallback.
3. **Stage 3 (Tertiary):** Raw binary stream string object extractor.

### 2. GitHub Public Repository Inspection Matrix
Located in [`src/lib/github/githubService.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/github/githubService.ts):
- Parses GitHub links and extracts repository owner & name.
- Retrieves `README.md` and strips raw HTML comments/badges to fit into context window.
- Fetches directory tree (`git/trees`) for file structure context.
- Fallback hierarchy: `resume+github_readme` $\rightarrow$ `resume+github_tree` $\rightarrow$ `resume_only`.

### 3. Voice Engine & Turn Detection (VAD)
Located in [`src/lib/voice/speechEngine.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/voice/speechEngine.ts):
- **Audio Output:** Plays spoken question aloud via `/api/tts` (OpenAI `tts-1` `alloy` voice) or client Web Speech API (`window.speechSynthesis`).
- **Microphone Input:** SpeechRecognition STT capturing candidate answer in real-time.
- **VAD Turn Detection:** 1.8 seconds of silence after candidate speaks automatically finalizes transcript, transitions state to `PROCESSING_ANSWER`, and submits to backend.

### 4. Selectable Company-Specific Technical Interview Styles
Configured centrally in [`src/lib/interviewer/styles.ts`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/lib/interviewer/styles.ts):
After resume analysis and before the interview begins, the candidate selects their desired interview style preset. The selection dictates **how** the AI probes, while the candidate's resume and GitHub projects dictate **what** is asked:

| Preset | Companies Included | Focus & Probing Emphasis | Example Grounded Question Angle (e.g., RAG Project) |
| :--- | :--- | :--- | :--- |
| **FAANG** | Meta, Amazon, Apple, Netflix, Google | Technical depth, algorithmic complexity, memory/runtime efficiency, low-level mechanics, boundary edge cases. | Chunking algorithm complexity, vector index runtime bounds, retrieval latency, boundary input handling. |
| **MANGOS** | Meta, Anthropic, NVIDIA, Google, OpenAI, SpaceX | Deep technical reasoning, AI/ML concepts, distributed system architecture, failure scenarios, performance trade-offs. | Embedding model trade-offs, vector DB scaling bottlenecks, pipeline failure modes under upstream timeouts. |
| **Big 4** | Deloitte, PwC, EY, KPMG | Practical software engineering, database schemas & indexing, API contracts, error handling, production debugging, reliability. | Relational database modeling, query indexing, API schema contracts, production logging, data consistency. |

* **Strict Grounding:** Candidates never select an isolated topic. No HR or behavioral questions are introduced; all three styles remain strictly technical.
* **Session Persistence:** The selected style is stored in the database (`Interview.style`), persists across session reconnects, guides dynamic follow-up evaluations, and appears in the final evaluation report.

### 5. Cinematic Motion Landing Page & Visual Identity
Designed to deliver a premium, futuristic AI technology aesthetic rather than a generic recruitment board:
* **Color Palette & Tokens:** Defined in [`src/app/globals.css`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/src/app/globals.css) via HSL variables: Background `260 87% 3%`, Foreground `40 6% 95%`, Secondary `40 6% 82%`, and multi-stop accents (Indigo `#6366f1`, Violet `#a855f7`, Cyan `#22d3ee`).
* **Typography:** General Sans for bold, fluid headlines (`clamp(3rem, 7.5vw, 6rem)` with letter spacing `-0.035em` and line height `1.02`), paired with Geist Sans for clear body text.
* **Full-Viewport Video Background:** Full-viewport hero (`min-height: 100svh`) with looping video background powered by a `requestAnimationFrame` controller (smooth 0.5s fade-in, 0.5s fade-out near loop end, 100ms reset cycle, and fallback for `prefers-reduced-motion`).
* **Centered Headline Backdrop Blur:** Separate centered blurred shape (`.hero-headline-backdrop` with `backdrop-filter: blur(36px)`) behind the headline ensuring contrast without applying a full gradient overlay on top of the video.
* **Capabilities Marquee:** Pinned near the bottom of the hero with a fixed `"BUILT AROUND YOUR EXPERIENCE"` badge and a seamless 20s infinite loop of product capability tiles with abstract symbols.
* **Liquid Glass Effect:** Reusable `.liquid-glass` utility class featuring translucent surfaces, backdrop blur, inset highlights, and hover transitions.
* **Below-the-Fold Exploration:** Modular sections for `#how-it-works` (6-step pipeline), `#interview-styles` (FAANG, MANGOS, Big 4 cards), and `#features` (architectural differentiators), leading into the resume upload flow.

---

## 🗄️ Database Schema (Prisma)

Managed via [`prisma/schema.prisma`](file:///c:/Users/amoli/OneDrive/Desktop/IntervAI/prisma/schema.prisma):

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
  |        |                                                                   | 1:1
  | 1:1    | 1:N                                                               v
  v        v                                                          +-----------------+
+----+  +---------------+                                             | InterviewAnswer |
|Eval|  |InterviewAnswer|<--------------------------------------------+-----------------+
+----+  +---------------+
```

---

## 🔌 API Map Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/resume/upload` | `POST` | Uploads PDF resume, extracts text, executes NLP parsing, inspects GitHub repos, saves DB models. |
| `/api/interview/start` | `POST` | Accepts `{ resumeId, style }`, compiles CandidateContext, and initializes `Interview` with selected style. |
| `/api/interview/session` | `POST` | Returns session configuration, system instructions tailored to selected style, and active style preset. |
| `/api/interview/answer` | `POST` | Persists a single question & candidate transcript turn to DB. |
| `/api/tts` | `POST` | Generates MP3 audio for AI spoken questions using OpenAI TTS. |
| `/api/interview/end` | `POST` | Finalizes interview and triggers AI Evaluation Engine. |
| `/api/interview/[id]/results` | `GET` | Fetches overall score, style preset, strengths, areas for improvement, per-question analysis, and transcript. |

---

## 📂 Project Structure

```
IntervAI/
├── prisma/
│   └── schema.prisma              # Prisma ORM Database Models
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── resume/upload/     # PDF Upload & NLP Processing API
│   │   │   ├── interview/start/   # Session Initialization API
│   │   │   ├── interview/session/ # Realtime Session Configuration API
│   │   │   ├── interview/answer/  # Turn Persistence API
│   │   │   ├── interview/end/     # Evaluation Trigger API
│   │   │   ├── interview/[id]/results/ # Evaluation Results API
│   │   │   └── tts/               # Text-To-Speech Audio API
│   │   ├── interview/[id]/        # Live Voice Interview Screen
│   │   ├── processing/[id]/       # Context Processing Screen
│   │   ├── results/[id]/          # Assessment & Report Screen
│   │   ├── globals.css            # Dark Mode & Glassmorphism Design System
│   │   ├── layout.tsx             # Root Application Layout
│   │   └── page.tsx               # Landing Page & Resume Upload Dropzone
│   └── lib/
│       ├── db.ts                  # Prisma Client Singleton Instance
│       ├── context/               # Candidate Context Aggregator
│       ├── github/                # GitHub REST API Service
│       ├── interviewer/           # Grounded System Prompt Generator
│       ├── nlp/                   # Resume Text Extractor & NLP Parser
│       ├── voice/                 # SpeechEngine (TTS, STT, VAD)
│       └── evaluation/            # Post-Interview AI Evaluator Engine
├── scripts/
│   └── test_runner.ts             # System Integrity & Grounding Test Suite
├── package.json                   # Dependencies & Scripts
└── README.md                      # Detailed System Documentation
```

---

## ⚡ Local Setup & Installation

### Prerequisites
* Node.js v20.x or higher
* npm / pnpm / yarn

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Amolika123/IntervAI.git
cd IntervAI
npm install
```

### 2. Environment Variables Configuration
Create a `.env.local` file in the root directory:
```env
# Database Connection (SQLite local fallback / PostgreSQL string)
DATABASE_URL="file:./dev.db"

# OpenAI API Key (Required for structured NLP, TTS audio & Evaluation)
OPENAI_API_KEY="your-openai-api-key-here"

# GitHub Token (Optional: Increases GitHub REST API rate limits)
GITHUB_TOKEN="your-github-personal-access-token"
```

### 3. Initialize Database
```bash
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the automated system integrity test suite verifying URL parsing, candidate context aggregation, and system prompt grounding guardrails:

```bash
npx tsx scripts/test_runner.ts
```

To run a production build verification:
```bash
npm run build
```

---

## 📄 License & Attribution

Developed for **IntervAI** — Resume-Grounded AI Technical Interviewer.
