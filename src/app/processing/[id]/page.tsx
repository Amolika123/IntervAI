'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Loader2,
  Cpu,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Code2,
  Layers,
  Building2,
  Zap
} from 'lucide-react';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';

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
        const cachedStr = sessionStorage.getItem('resumeData');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached.resumeId === resumeId) {
            setCandidateData(cached.candidateContext);
          }
        }

        // Animate processing stages for clear visual feedback
        for (let i = 0; i < steps.length; i++) {
          if (!mounted) return;
          setActiveStep(i);
          await new Promise(r => setTimeout(r, 550));
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
        body: JSON.stringify({ resumeId, style: selectedStyle })
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

  const candidateName = candidateData?.candidate?.name || 'Candidate';
  const projectsCount = candidateData?.projects?.length || 0;

  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: isProcessing ? '640px' : '980px', width: '100%', transition: 'all 0.4s ease' }}>
        
        {/* State 1: Processing Stages */}
        {isProcessing && (
          <div className="glass-panel" style={{ padding: '3rem 2.5rem', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)'
            }}>
              <Cpu size={28} color="#ffffff" />
            </div>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Analyzing Your <span className="gradient-text">Resume & Projects</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem' }}>
              Extracting candidate profile, inspecting GitHub READMEs, and locking question grounding rules...
            </p>

            {errorMessage ? (
              <div style={{
                padding: '1.25rem',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                textAlign: 'center'
              }}>
                <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{errorMessage}</p>
                <button onClick={() => router.push('/')} className="btn-secondary">
                  Return to Upload
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                {steps.map((step, idx) => {
                  const isDone = idx < activeStep;
                  const isCurrent = idx === activeStep;

                  return (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: isCurrent ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrent ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                      transition: 'all 0.3s ease'
                    }}>
                      <div>
                        {isDone ? (
                          <CheckCircle2 size={22} color="var(--accent-cyan)" />
                        ) : isCurrent ? (
                          <Loader2 size={22} color="var(--accent-indigo)" style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid var(--text-muted)' }} />
                        )}
                      </div>
                      <div>
                        <div style={{
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)',
                          fontSize: '0.95rem'
                        }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {step.detail}
                        </div>
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
          <div className="glass-panel" style={{ padding: '2.5rem 2rem' }}>
            
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                borderRadius: '30px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: 'var(--accent-indigo)',
                fontSize: '0.85rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}>
                <ShieldCheck size={16} />
                <span>Resume Grounded Dossier Ready ({projectsCount} Projects Loaded)</span>
              </div>

              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.5px', marginBottom: '0.5rem' }}>
                Choose Your <span className="gradient-text">Interview Style</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: '640px', margin: '0 auto' }}>
                Your resume claims dictate <strong>WHAT</strong> is asked. The selected company preset determines <strong>HOW</strong> deeply the AI interviewer probes your architecture, trade-offs, and implementation.
              </p>
            </div>

            {/* Configurable Style Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem'
            }}>
              {(Object.keys(INTERVIEW_STYLES) as InterviewStyleId[]).map((styleId) => {
                const config = INTERVIEW_STYLES[styleId];
                const isSelected = selectedStyle === styleId;

                const getIcon = () => {
                  if (styleId === 'FAANG') return <Code2 size={24} color={config.color} />;
                  if (styleId === 'MANGOS') return <Zap size={24} color={config.color} />;
                  return <Building2 size={24} color={config.color} />;
                };

                return (
                  <div
                    key={styleId}
                    onClick={() => setSelectedStyle(styleId)}
                    style={{
                      padding: '1.5rem',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      border: isSelected ? `2px solid ${config.color}` : '1px solid var(--border-color)',
                      background: isSelected
                        ? 'rgba(22, 28, 46, 0.95)'
                        : 'var(--gradient-card)',
                      boxShadow: isSelected
                        ? `0 12px 30px -10px ${config.color}40, inset 0 0 15px ${config.color}15`
                        : 'none',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Row: Icon, Title & Radio Indicator */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${config.color}30`
                          }}>
                            {getIcon()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                              {config.name}
                            </div>
                            <span style={{
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: config.color,
                              letterSpacing: '0.5px'
                            }}>
                              {config.badge}
                            </span>
                          </div>
                        </div>

                        {/* Radio selection indicator */}
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: isSelected ? `2px solid ${config.color}` : '2px solid var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? config.color : 'transparent',
                          transition: 'all 0.2s ease'
                        }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff' }} />}
                        </div>
                      </div>

                      {/* Included Companies Tags */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                          Companies Covered:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {config.companies.map((company, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.75rem',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isSelected ? `${config.color}20` : 'rgba(255, 255, 255, 0.05)',
                                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                border: isSelected ? `1px solid ${config.color}40` : '1px solid rgba(255, 255, 255, 0.08)',
                                fontWeight: 500
                              }}
                            >
                              {company}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Tagline & Description */}
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>
                        {config.description}
                      </p>

                      {/* Key Focus Points */}
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                          Interview Focus Areas:
                        </div>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {config.focusAreas.slice(0, 3).map((item, i) => (
                            <li key={i} style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: config.color, fontWeight: 700 }}>•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error Message if starting fails */}
            {errorMessage && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.9rem',
                textAlign: 'center'
              }}>
                {errorMessage}
              </div>
            )}

            {/* Bottom Bar: Grounding Disclaimer & Launch Button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1.25rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '500px' }}>
                <Sparkles size={16} color="var(--accent-indigo)" style={{ flexShrink: 0 }} />
                <span>
                  Preset: <strong>{INTERVIEW_STYLES[selectedStyle].name}</strong> • Questions are inspired by public interview patterns and grounded 100% in your resume projects.
                </span>
              </div>

              <button
                onClick={handleStartInterview}
                disabled={isStarting}
                className="btn-primary"
                style={{ padding: '14px 32px', fontSize: '1rem' }}
              >
                {isStarting ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Configuring Interviewer...</span>
                  </>
                ) : (
                  <>
                    <span>Start Technical Interview</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
