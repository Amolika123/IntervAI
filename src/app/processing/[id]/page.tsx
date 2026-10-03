'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, GitBranch, Cpu, Sparkles, AlertCircle } from 'lucide-react';

interface ProcessingProps {
  params: Promise<{ id: string }>;
}

export default function ProcessingPage({ params }: ProcessingProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const resumeId = resolvedParams.id;

  const [activeStep, setActiveStep] = useState(0);
  const [candidateData, setCandidateData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps = [
    { label: 'Reading PDF Resume Text', detail: 'Parsing document layout and content' },
    { label: 'Extracting Candidate Profile', detail: 'Identifying skills, experience, and project claims' },
    { label: 'Inspecting GitHub Links', detail: 'Validating public repository URLs' },
    { label: 'Retrieving Project Context', detail: 'Extracting README markdown & file tree structure' },
    { label: 'Building Grounded Context', detail: 'Synthesizing interview context dossier' },
    { label: 'Initializing AI Interviewer', detail: 'Loading grounded prompt instructions' },
  ];

  useEffect(() => {
    let mounted = true;

    async function initInterview() {
      try {
        // Step 1: Check session data or fetch from backend
        const cachedStr = sessionStorage.getItem('resumeData');
        let parsedContext = null;

        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached.resumeId === resumeId) {
            parsedContext = cached.candidateContext;
          }
        }

        // Animate processing stages for clear visual feedback
        for (let i = 0; i < steps.length - 1; i++) {
          if (!mounted) return;
          setActiveStep(i);
          await new Promise(r => setTimeout(r, 600));
        }

        // Call backend /api/interview/start
        const res = await fetch('/api/interview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to initialize interview context.');
        }

        if (mounted) {
          setActiveStep(steps.length - 1);
          setCandidateData(data.candidateContext);
          await new Promise(r => setTimeout(r, 800));
          // Redirect to live interview view
          router.push(`/interview/${data.interviewId}`);
        }

      } catch (err: any) {
        if (mounted) {
          setErrorMessage(err.message || 'An error occurred while preparing your interview.');
        }
      }
    }

    initInterview();

    return () => { mounted = false; };
  }, [resumeId, router]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div className="glass-panel" style={{ maxWidth: '640px', width: '100%', padding: '3rem 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
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
            Preparing Your <span className="gradient-text">Personalized Interview</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Analyzing resume projects, extracting GitHub READMEs, and locking question grounding rules...
          </p>
        </div>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

        <style jsx global>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </main>
  );
}
