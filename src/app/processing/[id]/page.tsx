'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  Cpu,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Code2,
  Layers,
  Building2,
  Zap,
} from 'lucide-react';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';
import PageShell from '@/components/layout/PageShell';

interface ProcessingProps {
  params: Promise<{ id: string }>;
}

export default function ProcessingPage({ params }: ProcessingProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const resumeId = resolvedParams.id;

  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState<InterviewStyleId>('FAANG');
  const [isStarting, setIsStarting] = useState(false);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps = [
    { label: 'Reading PDF Resume Text', detail: 'Parsing document layout and content' },
    { label: 'Extracting Candidate Profile', detail: 'Identifying skills, experience, and project claims' },
    { label: 'Inspecting GitHub Links', detail: 'Validating public repository URLs' },
    { label: 'Retrieving Project Context', detail: 'Extracting README markdown & file tree structure' },
    { label: 'Synthesizing Grounded Dossier', detail: 'Locking grounded question constraints' },
  ];

  useEffect(() => {
    let mounted = true;

    async function runProcessing() {
      try {
        let loadedData = null;
        const cachedStr = sessionStorage.getItem('resumeData');
        if (cachedStr) {
          try {
            const cached = JSON.parse(cachedStr);
            if (cached.resumeId === resumeId && cached.candidateContext) {
              loadedData = cached.candidateContext;
              setCandidateData(loadedData);
            }
          } catch (e) {
            console.warn('Error reading cached resume:', e);
          }
        }

        if (!loadedData) {
          const fetchRes = await fetch(`/api/resume/${resumeId}`);
          if (fetchRes.ok) {
            const fetchedJson = await fetchRes.json();
            if (fetchedJson.success && fetchedJson.candidateContext) {
              loadedData = fetchedJson.candidateContext;
              setCandidateData(loadedData);
            }
          }
        }

        // Animate processing stages for clear visual feedback
        for (let i = 0; i < steps.length; i++) {
          if (!mounted) return;
          setActiveStep(i);
          await new Promise((r) => setTimeout(r, 550));
        }

        if (mounted) {
          setIsProcessing(false);
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMessage(err.message || 'An error occurred while preparing your resume context.');
        }
      }
    }

    runProcessing();

    return () => {
      mounted = false;
    };
  }, [resumeId]);

  const handleStartInterview = async () => {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/interview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId, style: selectedStyle }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initialize interview context.');
      }

      router.push(`/interview/${data.interviewId}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to launch interview session. Please try again.');
      setIsStarting(false);
    }
  };

  const projectsCount = candidateData?.projects?.length || 0;

  return (
    <PageShell
      title={isProcessing ? 'Analyzing Candidate Dossier' : 'Interview Style Calibration'}
      badge={
        <span className="fm-proc-badge">
          <Layers size={13} />
          <span>Stage 02 of 04</span>
        </span>
      }
      maxWidth={isProcessing ? '640px' : '1080px'}
    >
      <div className="fm-proc-container">
        {/* State 1: Processing Stages */}
        {isProcessing && (
          <div className="glass-panel fm-proc-panel">
            <div className="fm-proc-icon-wrap">
              <Cpu size={28} color="#00f0ff" />
            </div>

            <h2 className="fm-proc-title">
              Analyzing Your <span className="gradient-text">Resume & Projects</span>
            </h2>
            <p className="fm-proc-subtitle">
              Extracting candidate profile, inspecting GitHub READMEs, and locking question grounding rules...
            </p>

            {errorMessage ? (
              <div className="fm-proc-error">
                <AlertCircle size={28} />
                <p>{errorMessage}</p>
                <button onClick={() => router.push('/')} className="btn-secondary">
                  Return to Upload
                </button>
              </div>
            ) : (
              <div className="fm-steps-list">
                {steps.map((step, idx) => {
                  const isDone = idx < activeStep;
                  const isCurrent = idx === activeStep;

                  return (
                    <div
                      key={idx}
                      className={`fm-step-item ${isCurrent ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                    >
                      <div className="fm-step-indicator">
                        {isDone ? (
                          <CheckCircle2 size={20} color="#22c55e" />
                        ) : isCurrent ? (
                          <Loader2 size={20} color="#00f0ff" className="spin-icon" />
                        ) : (
                          <div className="fm-step-pending-dot" />
                        )}
                      </div>
                      <div className="fm-step-content">
                        <div className="fm-step-label">{step.label}</div>
                        <div className="fm-step-detail">{step.detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* State 2: Choose Your Interview Style Section */}
        {!isProcessing && (
          <div className="glass-panel fm-style-panel">
            {/* Header */}
            <div className="fm-style-header">
              <div className={`fm-dossier-pill ${projectsCount === 0 ? 'is-warning' : ''}`}>
                {projectsCount > 0 ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
                <span>
                  {projectsCount > 0
                    ? `Resume Grounded Dossier Ready (${projectsCount} Projects Loaded)`
                    : 'No Technical Projects Identified'}
                </span>
              </div>

              <h1 className="fm-style-title-main">
                Choose Your <span className="gradient-text">Interview Style</span>
              </h1>
              <p className="fm-style-rule-text">
                Your resume claims dictate <strong>WHAT</strong> is asked. The selected company preset determines{' '}
                <strong>HOW</strong> deeply the AI interviewer probes your architecture, trade-offs, and implementation.
              </p>
            </div>

            {/* Warning when project extraction failed */}
            {projectsCount === 0 && (
              <div className="fm-project-warning">
                <AlertCircle size={24} className="warning-icon" />
                <div>
                  <strong>Project extraction note:</strong> No specific technical projects were parsed from your resume.
                  The interviewer will fall back to general role experience. Uploading a resume with project sections yields optimal grounded questioning.
                </div>
              </div>
            )}

            {/* Configurable Style Cards Grid */}
            <div className="fm-styles-grid">
              {(Object.keys(INTERVIEW_STYLES) as InterviewStyleId[]).map((styleId) => {
                const config = INTERVIEW_STYLES[styleId];
                const isSelected = selectedStyle === styleId;

                const getIcon = () => {
                  if (styleId === 'FAANG') return <Code2 size={22} color="#00f0ff" />;
                  if (styleId === 'MANGOS') return <Zap size={22} color="#00f0ff" />;
                  return <Building2 size={22} color="#00f0ff" />;
                };

                return (
                  <div
                    key={styleId}
                    onClick={() => setSelectedStyle(styleId)}
                    className={`fm-style-card-choice ${isSelected ? 'is-selected' : ''}`}
                    tabIndex={0}
                    role="radio"
                    aria-checked={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setSelectedStyle(styleId);
                      }
                    }}
                  >
                    <div className="choice-header">
                      <div className="choice-title-group">
                        <div className="choice-icon-wrap">{getIcon()}</div>
                        <div>
                          <div className="choice-name">{config.name}</div>
                          <div className="choice-subtitle">{config.badge}</div>
                        </div>
                      </div>
                      <div className={`choice-radio ${isSelected ? 'is-checked' : ''}`}>
                        {isSelected && <div className="choice-radio-inner" />}
                      </div>
                    </div>

                    <div className="choice-companies">
                      <strong>Companies:</strong> {config.companies.join(', ')}
                    </div>

                    <p className="choice-desc">{config.description}</p>

                    <div className="choice-probing-points">
                      <div className="probing-label">Core Probing Vectors:</div>
                      {config.focusAreas.map((point: string, i: number) => (
                        <div key={i} className="probing-item">
                          <CheckCircle2 size={13} color="#00d9ff" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explanatory Rule Callout */}
            <div className="fm-rule-callout">
              <span className="rule-dot" />
              <span>
                &ldquo;Your resume determines what is asked. Your selected interview style determines how deeply the interviewer probes.&rdquo;
              </span>
            </div>

            {/* Error Message if Launch Failed */}
            {errorMessage && (
              <div className="fm-launch-error">
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Launch Action */}
            <div className="fm-launch-action">
              <button
                type="button"
                onClick={handleStartInterview}
                disabled={isStarting}
                className="btn-primary fm-start-btn"
              >
                {isStarting ? (
                  <>
                    <Loader2 size={18} className="spin-icon" />
                    <span>Calibrating Voice Session...</span>
                  </>
                ) : (
                  <>
                    <span>Start Interview Session ({INTERVIEW_STYLES[selectedStyle].name})</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .fm-proc-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 9999px;
          background: rgba(0, 217, 255, 0.15);
          border: 1px solid rgba(0, 217, 255, 0.35);
          color: #00d9ff;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .fm-proc-container {
          width: 100%;
        }

        /* Processing Panel */
        .fm-proc-panel {
          padding: 3.5rem 2.5rem;
          text-align: center;
        }

        .fm-proc-icon-wrap {
          width: 60px;
          height: 60px;
          border-radius: 18px;
          background: rgba(0, 217, 255, 0.15);
          border: 1px solid rgba(0, 217, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem auto;
          box-shadow: 0 0 25px rgba(0, 217, 255, 0.3);
        }

        .fm-proc-title {
          font-size: 1.85rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }

        .fm-proc-subtitle {
          color: var(--text-secondary);
          font-size: 0.9375rem;
          max-width: 480px;
          margin: 0 auto 2.25rem auto;
          line-height: 1.5;
        }

        .fm-proc-error {
          padding: 1.5rem;
          border-radius: 14px;
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .fm-steps-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          text-align: left;
        }

        .fm-step-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.85rem 1.15rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: all 0.25s ease;
        }

        .fm-step-item.is-current {
          background: rgba(0, 217, 255, 0.12);
          border-color: rgba(0, 217, 255, 0.45);
          box-shadow: 0 0 15px rgba(0, 217, 255, 0.15);
        }

        .fm-step-indicator {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
        }

        .fm-step-pending-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.25);
        }

        .fm-step-content {
          flex: 1;
        }

        .fm-step-label {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #ffffff;
        }

        .fm-step-item.is-done .fm-step-label {
          color: rgba(255, 255, 255, 0.85);
        }

        .fm-step-detail {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.6);
        }

        /* Style Selection Panel */
        .fm-style-panel {
          padding: 3rem 2.5rem;
        }

        .fm-style-header {
          text-align: center;
          max-width: 720px;
          margin: 0 auto 2.5rem auto;
        }

        .fm-dossier-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 1rem;
          border-radius: 9999px;
          background: rgba(0, 217, 255, 0.14);
          border: 1px solid rgba(0, 217, 255, 0.35);
          color: #00d9ff;
          font-size: 0.8125rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .fm-dossier-pill.is-warning {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
          color: #f59e0b;
        }

        .fm-style-title-main {
          font-size: clamp(2rem, 3.2vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          margin-bottom: 0.75rem;
        }

        .fm-style-rule-text {
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        .fm-project-warning {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fef3c7;
          font-size: 0.875rem;
          margin-bottom: 2rem;
        }

        .fm-styles-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.5rem;
          margin-bottom: 2.5rem;
        }

        @media (max-width: 900px) {
          .fm-styles-grid {
            grid-template-columns: 1fr;
          }
        }

        .fm-style-card-choice {
          padding: 1.75rem;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.18);
          cursor: pointer;
          outline: none;
          transition: all 0.25s ease;
          display: flex;
          flex-direction: column;
        }

        .fm-style-card-choice:hover {
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(0, 217, 255, 0.4);
          transform: translateY(-2px);
        }

        .fm-style-card-choice.is-selected {
          background: rgba(7, 83, 191, 0.55);
          border-color: #00d9ff;
          box-shadow: 0 0 25px rgba(0, 217, 255, 0.35);
          transform: translateY(-3px);
        }

        .fm-style-card-choice:focus-visible {
          outline: 2px solid #00d9ff;
          outline-offset: 3px;
        }

        .choice-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1rem;
        }

        .choice-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .choice-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(0, 217, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .choice-name {
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
        }

        .choice-subtitle {
          font-size: 0.75rem;
          color: #00d9ff;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .choice-radio {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s ease;
        }

        .choice-radio.is-checked {
          border-color: #00d9ff;
        }

        .choice-radio-inner {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #00d9ff;
          box-shadow: 0 0 8px #00d9ff;
        }

        .choice-companies {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.75);
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        .choice-desc {
          font-size: 0.875rem;
          line-height: 1.55;
          color: rgba(255, 255, 255, 0.88);
          margin-bottom: 1.25rem;
          flex: 1;
        }

        .choice-probing-points {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .probing-label {
          font-size: 0.6875rem;
          text-transform: uppercase;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.5);
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .probing-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.8);
        }

        .fm-rule-callout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          text-align: center;
          font-size: 0.875rem;
          font-style: italic;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 2rem;
        }

        .rule-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00d9ff;
        }

        .fm-launch-error {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }

        .fm-launch-action {
          display: flex;
          justify-content: center;
        }

        .fm-start-btn {
          min-width: 320px;
          padding: 1rem 2rem;
          font-size: 1rem;
        }

        :global(.spin-icon) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </PageShell>
  );
}
