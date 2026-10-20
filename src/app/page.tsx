'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Cpu,
  GitBranch,
  Mic,
  ShieldCheck,
  ArrowRight,
  Layers,
  CheckCircle2,
  Code2,
  X,
  AlertTriangle,
  GitPullRequest,
  Zap,
} from 'lucide-react';
import RobotHelmet from '@/components/robot/RobotHelmet';
import ChamferButton from '@/components/ui/ChamferButton';
import NavHeader from '@/components/navigation/NavHeader';

export default function LandingPage() {
  const router = useRouter();

  // Resume upload modal & state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf')) {
        setErrorMessage('Please select a valid PDF resume.');
        return;
      }
      setFile(selected);
      setErrorMessage(null);
      setIsUploadModalOpen(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (selected.name.endsWith('.pdf')) {
        setFile(selected);
        setErrorMessage(null);
        setIsUploadModalOpen(true);
      } else {
        setErrorMessage('Only PDF resumes are supported.');
        setIsUploadModalOpen(true);
      }
    }
  };

  const triggerUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload and parse resume.');
      }

      sessionStorage.setItem('resumeData', JSON.stringify(data));
      router.push(`/processing/${data.resumeId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while uploading your resume.');
      setIsUploading(false);
    }
  };

  return (
    <div className="fm-root">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* ================================================== */}
      {/* HERO SECTION — FUTURE MACHINE BLUE GRADIENT THEME  */}
      {/* ================================================== */}
      <section className="fm-hero" aria-label="IntervAI Hero Section">
        {/* Soft Radial Illumination behind Central Robot */}
        <div className="fm-hero-illumination" aria-hidden="true" />

        {/* Thin Vertical Architectural Rules along outer edges (Desktop) */}
        <div className="fm-vrule fm-vrule-left" aria-hidden="true">
          <span className="fm-vrule-seg fm-vrule-end" />
          <span className="fm-vrule-plus">+</span>
          <span className="fm-vrule-seg fm-vrule-mid" />
          <span className="fm-vrule-plus">+</span>
          <span className="fm-vrule-seg fm-vrule-end" />
        </div>
        <div className="fm-vrule fm-vrule-right" aria-hidden="true">
          <span className="fm-vrule-seg fm-vrule-end" />
          <span className="fm-vrule-plus">+</span>
          <span className="fm-vrule-seg fm-vrule-mid" />
          <span className="fm-vrule-plus">+</span>
          <span className="fm-vrule-seg fm-vrule-end" />
        </div>

        {/* Navigation Bar with Dominant Top-Left Brand */}
        <NavHeader onUploadResume={triggerUploadClick} />

        {/* Hero Composition Stage */}
        <div className="fm-hero-stage">
          {/* Centre Animated Robot Helmet */}
          <div className="fm-hero-center-robot">
            <RobotHelmet />
          </div>

          {/* Bottom-Left Descriptive Copy & CTA */}
          <div className="fm-hero-bottom-left">
            <div className="fm-eyebrow">RESUME-GROUNDED AI INTERVIEWER</div>
            <h2 className="fm-headline">
              Your Work.
              <br />
              Your Interview.
            </h2>
            <p className="fm-body-text">
              An AI technical interviewer that understands your resume and projects,
              then asks deeper technical questions through a real-time voice conversation.
            </p>
            <div className="fm-cta-box">
              <ChamferButton
                onClick={triggerUploadClick}
                label="Start Your Interview"
                ariaLabel="Start Your Interview by uploading your resume"
              />
            </div>
          </div>

          {/* Bottom-Right Supporting Label & Preset Scope */}
          <div className="fm-hero-bottom-right">
            <h3 className="fm-sub-heading">Technical Interviewing, Reimagined</h3>
            <div className="fm-styles-pill">FAANG · MANGOS · BIG 4</div>
            <p className="fm-sub-text">
              One interviewer. Three technical interview styles. Questions grounded in your own experience.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/* 2. HOW IT WORKS SECTION                            */}
      {/* ================================================== */}
      <section id="how-it-works" className="fm-section fm-section-white">
        <div className="fm-container">
          <div className="fm-section-header">
            <div className="fm-badge">
              <Zap size={14} />
              <span>Voice-First Technical Flow</span>
            </div>
            <h2 className="fm-section-title">How It Works</h2>
            <p className="fm-section-subtitle">
              A precision-engineered assessment pipeline that replaces canned trivia with deep, resume-grounded technical inquiry.
            </p>
          </div>

          <div className="fm-grid-3">
            {/* Step 1 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 01</span>
                <div className="fm-card-icon">
                  <UploadCloud size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Upload Your Resume</h3>
              <p className="fm-card-desc">
                Provide your existing technical resume in PDF format. Text extraction uses a resilient multi-tier parser to capture every skill, tool, and project.
              </p>
            </div>

            {/* Step 2 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 02</span>
                <div className="fm-card-icon">
                  <Cpu size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Extract Experience & Projects</h3>
              <p className="fm-card-desc">
                IntervAI structures technologies, system architectures, work history, and repository links into a comprehensive Candidate Context Dossier.
              </p>
            </div>

            {/* Step 3 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 03</span>
                <div className="fm-card-icon">
                  <GitBranch size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Inspect GitHub Repositories</h3>
              <p className="fm-card-desc">
                Linked public GitHub repositories are inspected automatically, extracting README documentation and folder structures for code-level grounding.
              </p>
            </div>

            {/* Step 4 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 04</span>
                <div className="fm-card-icon">
                  <Layers size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Choose Interview Style</h3>
              <p className="fm-card-desc">
                Select between FAANG, MANGOS, or Big 4 presets to calibrate whether questions probe algorithmic complexity, distributed scale, or enterprise robustness.
              </p>
            </div>

            {/* Step 5 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 05</span>
                <div className="fm-card-icon">
                  <Mic size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Live Voice Interview</h3>
              <p className="fm-card-desc">
                The AI speaks questions aloud. You answer naturally into your microphone. Real-time Voice Activity Detection captures your spoken technical answers.
              </p>
            </div>

            {/* Step 6 */}
            <div className="fm-card">
              <div className="fm-card-top">
                <span className="fm-step-num">STEP 06</span>
                <div className="fm-card-icon">
                  <CheckCircle2 size={20} />
                </div>
              </div>
              <h3 className="fm-card-title">Receive Detailed Evaluation</h3>
              <p className="fm-card-desc">
                Review your overall score (0–100), key strengths, growth areas, and turn-by-turn feedback analyzing your responses against your background.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/* 3. INTERVIEW STYLES SECTION                        */}
      {/* ================================================== */}
      <section id="interview-styles" className="fm-section fm-section-blue">
        <div className="fm-container">
          <div className="fm-section-header fm-header-light">
            <div className="fm-badge fm-badge-light">
              <Layers size={14} />
              <span>Configurable Probing Presets</span>
            </div>
            <h2 className="fm-section-title">Choose Your Interview Style</h2>
            <p className="fm-section-subtitle">
              Each preset changes <em>how</em> the interviewer probes technical depth, while your resume and projects dictate <em>what</em> is asked.
            </p>
          </div>

          <div className="fm-grid-3">
            {/* FAANG Card */}
            <div className="fm-style-card">
              <div className="fm-style-card-header">
                <span className="fm-style-title">FAANG</span>
                <span className="fm-style-tag">Depth & Algorithms</span>
              </div>
              <div className="fm-style-companies">
                Meta, Amazon, Apple, Netflix and Google
              </div>
              <p className="fm-style-desc">
                Emphasizes computational complexity, runtime bounds, data structure selections, implementation choices, boundary edge cases, and runtime optimizations grounded in your projects.
              </p>
              <ul className="fm-style-bullets">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Time & space complexity analysis</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Boundary input & edge-case handling</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Low-level mechanics & data structures</span>
                </li>
              </ul>
            </div>

            {/* MANGOS Card */}
            <div className="fm-style-card">
              <div className="fm-style-card-header">
                <span className="fm-style-title">MANGOS</span>
                <span className="fm-style-tag">Frontier AI & Systems</span>
              </div>
              <div className="fm-style-companies">
                Meta, Anthropic, NVIDIA, Google, OpenAI and SpaceX
              </div>
              <p className="fm-style-desc">
                Emphasizes architectural reasoning, AI/ML models, distributed scale, memory bottlenecks, failure modes under latency spikes, and first-principles design decisions evidenced by your work.
              </p>
              <ul className="fm-style-bullets">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Distributed architecture & scale trade-offs</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>AI/ML models, embeddings & compute bounds</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Degraded dependencies & fault recovery</span>
                </li>
              </ul>
            </div>

            {/* Big 4 Card */}
            <div className="fm-style-card">
              <div className="fm-style-card-header">
                <span className="fm-style-title">Big 4</span>
                <span className="fm-style-tag">Enterprise & Practical SE</span>
              </div>
              <div className="fm-style-companies">
                Deloitte, PwC, EY and KPMG
              </div>
              <p className="fm-style-desc">
                Emphasizes practical software engineering, database schemas and query indexing, API contracts, error validation, debugging workflows, and business-relevant operational constraints.
              </p>
              <ul className="fm-style-bullets">
                <li>
                  <CheckCircle2 size={16} />
                  <span>Database modeling & query integrity</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>API contracts & validation patterns</span>
                </li>
                <li>
                  <CheckCircle2 size={16} />
                  <span>Production debugging & logging standards</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/* 4. FEATURES & DIFFERENTIATORS                      */}
      {/* ================================================== */}
      <section id="features" className="fm-section fm-section-white">
        <div className="fm-container">
          <div className="fm-section-header">
            <div className="fm-badge">
              <ShieldCheck size={14} />
              <span>Architectural Differentiators</span>
            </div>
            <h2 className="fm-section-title">How IntervAI Is Different</h2>
            <p className="fm-section-subtitle">
              Designed from first principles to simulate an actual senior engineering lead interviewing you about your past technical work.
            </p>
          </div>

          <div className="fm-grid-3">
            <div className="fm-card">
              <div className="fm-card-icon">
                <Code2 size={24} />
              </div>
              <h3 className="fm-card-title">Resume-Grounded Questions</h3>
              <p className="fm-card-desc">
                Zero generic LeetCode puzzles or static textbook trivia. Every single question directly attributes to technologies, frameworks, and projects listed on your resume.
              </p>
            </div>

            <div className="fm-card">
              <div className="fm-card-icon">
                <GitPullRequest size={24} />
              </div>
              <h3 className="fm-card-title">Project-Aware Follow-Ups</h3>
              <p className="fm-card-desc">
                By inspecting your public GitHub README files and codebase structure, the interviewer probes your specific architectural choices, trade-offs, and boundary scenarios.
              </p>
            </div>

            <div className="fm-card">
              <div className="fm-card-icon">
                <Mic size={24} />
              </div>
              <h3 className="fm-card-title">Real-Time Voice Interaction</h3>
              <p className="fm-card-desc">
                Converse naturally without typing into a chatbox. The interviewer speaks aloud and listens through your microphone with low-latency Voice Activity Detection.
              </p>
            </div>
          </div>

          {/* Big Bottom Action Card */}
          <div className="fm-action-card">
            <h2 className="fm-action-title">Ready to test your technical depth?</h2>
            <p className="fm-action-desc">
              Upload your resume and experience an adaptive, voice-first technical interview calibrated to your real experience.
            </p>
            <div className="fm-action-cta">
              <ChamferButton
                onClick={triggerUploadClick}
                label="Start Your Interview"
                ariaLabel="Start Your Interview"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ================================================== */}
      {/* 5. FOOTER                                          */}
      {/* ================================================== */}
      <footer id="about" className="fm-footer">
        <div className="fm-container">
          <div className="fm-footer-brand-row">
            <span className="fm-footer-brand">IntervAI</span>
            <span className="fm-footer-dot">•</span>
            <span>Resume-Grounded AI Technical Interviewer</span>
          </div>

          <p className="fm-footer-disclaimer">
            IntervAI is an independent practice product designed for senior engineering interview preparation.
            Company presets are informal stylistic guidelines inspired by general public interview preparation
            and are not affiliated with or endorsed by named companies.
          </p>

          <div className="fm-footer-copy">
            © {new Date().getFullYear()} IntervAI. Your work. Your interview.
          </div>
        </div>
      </footer>

      {/* ================================================== */}
      {/* 6. RESUME UPLOAD MODAL                             */}
      {/* ================================================== */}
      {isUploadModalOpen && (
        <div
          className="fm-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) {
              setIsUploadModalOpen(false);
              setErrorMessage(null);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Upload Your Resume"
        >
          <div className="fm-modal-panel">
            <button
              onClick={() => {
                if (!isUploading) {
                  setIsUploadModalOpen(false);
                  setErrorMessage(null);
                }
              }}
              className="fm-modal-close"
              disabled={isUploading}
              aria-label="Close upload dialog"
            >
              <X size={18} />
            </button>

            <div className="fm-modal-header">
              <div className="fm-modal-icon-wrap">
                <UploadCloud size={28} />
              </div>
              <h3 className="fm-modal-title">Upload Your Technical Resume</h3>
              <p className="fm-modal-subtitle">
                Your resume is parsed privately to ground interview questions in your real projects.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`fm-modal-dropzone ${isDragOver ? 'is-dragover' : ''}`}
            >
              <FileText
                size={34}
                style={{ margin: '0 auto 0.75rem auto', opacity: file ? 1 : 0.6 }}
              />
              {file ? (
                <div>
                  <div className="fm-dropzone-filename">{file.name}</div>
                  <div className="fm-dropzone-filesize">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready for parsing
                  </div>
                </div>
              ) : (
                <div>
                  <div className="fm-dropzone-prompt">
                    Click to select or drag and drop your PDF resume
                  </div>
                  <div className="fm-dropzone-sub">Supported format: PDF up to 10MB</div>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="fm-modal-error">
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="fm-modal-actions">
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setErrorMessage(null);
                  }
                }}
                disabled={isUploading}
                className="fm-modal-cancel"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="fm-modal-submit"
              >
                {isUploading ? (
                  <>
                    <Cpu size={16} className="spin-icon" />
                    <span>Extracting & Parsing...</span>
                  </>
                ) : (
                  <>
                    <span>Start Interview Prep</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* GLOBAL SCOPED STYLES                               */}
      {/* ================================================== */}
      <style jsx>{`
        .fm-root {
          min-height: 100vh;
          width: 100%;
          background: #ffffff;
          color: #0f172a;
          font-family: Arial, Helvetica, sans-serif;
          overflow-x: hidden;
        }

        /* -------------------------------------------------------------
           HERO COMPOSITION & BLUE GRADIENT SYSTEM
           ------------------------------------------------------------- */
        .fm-hero {
          position: relative;
          width: 100%;
          height: 100vh;
          height: 100svh;
          height: 100dvh;
          background-color: #055bd3;
          background-image: linear-gradient(135deg, #0753bf 0%, #0069e9 50%, #0755c4 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Soft blue radial illumination behind central robot */
        .fm-hero-illumination {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle 600px at 50% 42%,
            rgba(0, 210, 255, 0.28) 0%,
            rgba(7, 83, 191, 0.15) 45%,
            transparent 75%
          );
          pointer-events: none;
          z-index: 1;
        }

        /* Thin vertical rules (Desktop) */
        .fm-vrule {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 5;
          display: none;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .fm-vrule-left {
          left: 1.5rem;
        }
        .fm-vrule-right {
          right: 1.5rem;
        }
        .fm-vrule-seg {
          width: 1px;
          background: rgba(255, 255, 255, 0.2);
        }
        .fm-vrule-end {
          height: 12%;
        }
        .fm-vrule-mid {
          flex: 1 1 0%;
        }
        .fm-vrule-plus {
          font-size: 0.75rem;
          line-height: 1;
          color: rgba(255, 255, 255, 0.45);
          padding: 0.25rem 0;
        }
        @media (min-width: 1024px) {
          .fm-vrule {
            display: flex;
          }
        }

        /* Hero Stage */
        .fm-hero-stage {
          position: relative;
          z-index: 10;
          flex: 1;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2.5rem 2.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* Centre Robot Helmet: positioned at top: 13.1%, left: 29.37%, width: 41.35% on desktop */
        .fm-hero-center-robot {
          position: absolute;
          top: 13.1%;
          left: 29.37%;
          width: 41.35%;
          max-width: 560px;
          height: auto;
          z-index: 8;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        /* Bottom-Left Column: compact enough to maintain spacious composition without overlapping robot */
        .fm-hero-bottom-left {
          position: relative;
          z-index: 15;
          max-width: 360px;
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .fm-eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.8);
        }

        .fm-headline {
          font-size: clamp(1.75rem, 3.2vw, 2.65rem);
          font-weight: 700;
          line-height: 1.15;
          letter-spacing: -0.03em;
          color: #ffffff;
          margin: 0;
        }

        .fm-body-text {
          font-size: clamp(0.8125rem, 1.05vw, 0.9375rem);
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.85);
          max-width: 350px;
          margin: 0;
        }

        .fm-cta-box {
          margin-top: 0.5rem;
        }

        /* Bottom-Right Supporting Label */
        .fm-hero-bottom-right {
          position: absolute;
          bottom: 2.5rem;
          right: 2.5rem;
          z-index: 15;
          max-width: 340px;
          text-align: right;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
          pointer-events: none;
        }

        .fm-sub-heading {
          font-size: 1.125rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #ffffff;
          margin: 0;
        }

        .fm-styles-pill {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 0.25rem 0.65rem;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 9999px;
          color: #ffffff;
        }

        .fm-sub-text {
          font-size: 0.8125rem;
          font-style: italic;
          line-height: 1.5;
          letter-spacing: 0.01em;
          color: rgba(255, 255, 255, 0.75);
          margin: 0;
        }

        /* -------------------------------------------------------------
           HERO RESPONSIVENESS (Aspect-ratio & Breakpoints)
           ------------------------------------------------------------- */
        @media (max-width: 1024px) {
          .fm-hero-center-robot {
            top: 14%;
            left: 28%;
            width: 44%;
          }
          .fm-hero-bottom-right {
            max-width: 280px;
          }
        }

        @media (max-width: 768px) {
          .fm-hero {
            height: auto;
            min-height: 100svh;
          }
          .fm-hero-stage {
            padding: 0 1.5rem 3rem;
            display: flex;
            flex-direction: column;
            gap: 1.75rem;
          }
          .fm-hero-center-robot {
            position: relative;
            top: auto;
            left: auto;
            width: 68%;
            max-width: 320px;
            margin: 0.5rem auto 1rem;
          }
          .fm-hero-bottom-left {
            margin-top: 0;
            max-width: 100%;
          }
          .fm-hero-bottom-right {
            position: relative;
            bottom: auto;
            right: auto;
            text-align: left;
            align-items: flex-start;
            max-width: 100%;
            margin-top: 1rem;
            padding-bottom: 2rem;
          }
        }

        @media (max-width: 480px) {
          .fm-hero-center-robot {
            width: 80%;
          }
        }

        /* -------------------------------------------------------------
           SECTIONS & CARDS (BELOW THE FOLD)
           ------------------------------------------------------------- */
        .fm-section {
          padding: 6rem 2rem;
          position: relative;
        }
        .fm-section-white {
          background: #f8fafc;
          color: #0f172a;
        }
        .fm-section-blue {
          background: linear-gradient(135deg, #0753bf 0%, #0069e9 50%, #0755c4 100%);
          color: #ffffff;
        }

        .fm-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .fm-section-header {
          text-align: center;
          max-width: 680px;
          margin: 0 auto 4rem;
        }
        .fm-section-title {
          font-size: clamp(2rem, 3.2vw, 2.75rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          margin: 0.75rem 0 1rem;
        }
        .fm-section-subtitle {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: #475569;
        }
        .fm-header-light .fm-section-title {
          color: #ffffff;
        }
        .fm-header-light .fm-section-subtitle {
          color: rgba(255, 255, 255, 0.85);
        }

        .fm-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.85rem;
          background: rgba(7, 83, 191, 0.08);
          border: 1px solid rgba(7, 83, 191, 0.2);
          border-radius: 9999px;
          color: #0753bf;
          font-size: 0.8125rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .fm-badge-light {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          color: #ffffff;
        }

        .fm-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        @media (max-width: 900px) {
          .fm-grid-3 {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }

        /* Standard Cards */
        .fm-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05);
          transition: transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease;
        }
        .fm-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 30px -6px rgba(7, 83, 191, 0.12);
          border-color: #cbd5e1;
        }

        .fm-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
        }
        .fm-step-num {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: #0753bf;
        }
        .fm-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(7, 83, 191, 0.08);
          color: #0753bf;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fm-card-title {
          font-size: 1.25rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #0f172a;
          margin-bottom: 0.75rem;
        }
        .fm-card-desc {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: #64748b;
        }

        /* Style Cards (FAANG, MANGOS, Big 4) */
        .fm-style-card {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 2.25rem 2rem;
          backdrop-filter: blur(8px);
          color: #ffffff;
          transition: transform 250ms ease, background 250ms ease;
        }
        .fm-style-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.35);
        }

        .fm-style-card-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
        }
        .fm-style-title {
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .fm-style-tag {
          font-size: 0.75rem;
          font-weight: 600;
          color: #00f0ff;
          letter-spacing: 0.04em;
        }
        .fm-style-companies {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 1.25rem;
        }
        .fm-style-desc {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          margin-bottom: 1.5rem;
        }
        .fm-style-bullets {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 0;
          margin: 0;
        }
        .fm-style-bullets li {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-size: 0.875rem;
          color: rgba(255, 255, 255, 0.85);
        }

        /* Big Bottom Action Card */
        .fm-action-card {
          margin-top: 5rem;
          background: linear-gradient(135deg, #0753bf 0%, #0069e9 100%);
          border-radius: 24px;
          padding: 4rem 2rem;
          text-align: center;
          color: #ffffff;
          box-shadow: 0 20px 50px -10px rgba(7, 83, 191, 0.35);
        }
        .fm-action-title {
          font-size: clamp(1.875rem, 3vw, 2.5rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          margin-bottom: 1rem;
        }
        .fm-action-desc {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          max-width: 600px;
          margin: 0 auto 2rem;
        }
        .fm-action-cta {
          display: flex;
          justify-content: center;
        }

        /* Footer */
        .fm-footer {
          background: #020b18;
          color: #94a3b8;
          padding: 4rem 2rem 3rem;
          border-top: 1px solid #1e293b;
        }
        .fm-footer-brand-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.9375rem;
          margin-bottom: 1.25rem;
        }
        .fm-footer-brand {
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
        }
        .fm-footer-dot {
          color: #475569;
        }
        .fm-footer-disclaimer {
          font-size: 0.8125rem;
          line-height: 1.6;
          color: #64748b;
          max-width: 800px;
          margin-bottom: 2rem;
        }
        .fm-footer-copy {
          font-size: 0.8125rem;
          color: #475569;
        }

        /* -------------------------------------------------------------
           UPLOAD MODAL STYLING
           ------------------------------------------------------------- */
        .fm-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(2, 11, 24, 0.75);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: fm-modal-fade 200ms ease;
        }
        @keyframes fm-modal-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .fm-modal-panel {
          position: relative;
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 20px;
          padding: 2.25rem 2rem;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.45);
          color: #0f172a;
          animation: fm-modal-slide 250ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fm-modal-slide {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .fm-modal-close {
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: #f1f5f9;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          cursor: pointer;
          transition: background 200ms ease, color 200ms ease;
        }
        .fm-modal-close:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .fm-modal-header {
          text-align: center;
          margin-bottom: 1.75rem;
        }
        .fm-modal-icon-wrap {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          background: rgba(7, 83, 191, 0.08);
          color: #0753bf;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
        }
        .fm-modal-title {
          font-size: 1.375rem;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 0.5rem;
        }
        .fm-modal-subtitle {
          font-size: 0.875rem;
          line-height: 1.5;
          color: #64748b;
        }

        .fm-modal-dropzone {
          border: 2px dashed #cbd5e1;
          border-radius: 14px;
          padding: 2.25rem 1.5rem;
          text-align: center;
          background: #f8fafc;
          cursor: pointer;
          transition: border-color 200ms ease, background 200ms ease;
        }
        .fm-modal-dropzone:hover,
        .fm-modal-dropzone.is-dragover {
          border-color: #0753bf;
          background: rgba(7, 83, 191, 0.04);
        }

        .fm-dropzone-filename {
          font-weight: 600;
          color: #0753bf;
          margin-bottom: 0.25rem;
        }
        .fm-dropzone-filesize {
          font-size: 0.8125rem;
          color: #64748b;
        }
        .fm-dropzone-prompt {
          font-weight: 500;
          color: #334155;
          margin-bottom: 0.25rem;
        }
        .fm-dropzone-sub {
          font-size: 0.8125rem;
          color: #94a3b8;
        }

        .fm-modal-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .fm-modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.75rem;
        }
        .fm-modal-cancel {
          padding: 0.65rem 1.25rem;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #475569;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 200ms ease;
        }
        .fm-modal-cancel:hover {
          background: #e2e8f0;
        }

        .fm-modal-submit {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.5rem;
          background: #0753bf;
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 200ms ease, opacity 200ms ease;
        }
        .fm-modal-submit:hover:not(:disabled) {
          background: #0069e9;
        }
        .fm-modal-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        :global(.spin-icon) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
