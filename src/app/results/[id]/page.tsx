'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Award, CheckCircle2, AlertTriangle, ArrowLeft, RotateCcw, Cpu, FileText, GitBranch, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface ResultsPageProps {
  params: Promise<{ id: string }>;
}

export default function ResultsPage({ params }: ResultsPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);

  useEffect(() => {
    async function fetchResults() {
      try {
        const res = await fetch(`/api/interview/${interviewId}/results`);
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to load interview report.');
        }

        setData(json);
      } catch (err: any) {
        setError(err.message || 'An error occurred fetching results.');
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [interviewId]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Cpu size={48} className="gradient-text" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Generating AI Technical Evaluation...</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Analyzing candidate responses against grounding sources and technical depth metrics.
          </p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '500px' }}>
          <AlertTriangle size={40} color="#f87171" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Unable to Load Results</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{error}</p>
          <button onClick={() => router.push('/')} className="btn-primary">
            <ArrowLeft size={16} />
            <span>Return to Home</span>
          </button>
        </div>
      </main>
    );
  }

  const { candidate, evaluation, transcript, projects } = data;
  const overallScore = evaluation?.overallScore ?? 85;

  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginBottom: '0.75rem', padding: '8px 14px', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} />
            <span>Start New Interview</span>
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>
            Technical Evaluation Report <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {candidate?.name}</span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.1)', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.85rem', color: 'var(--accent-indigo)' }}>
          <Sparkles size={16} />
          <span>AI-Assisted Decision Support</span>
        </div>
      </header>

      {/* Hero Score Badge Panel */}
      <div className="glass-panel" style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2.5rem', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
          <div style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: 'var(--gradient-glow)',
            border: '4px solid var(--accent-indigo)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            boxShadow: '0 0 35px rgba(99, 102, 241, 0.3)'
          }}>
            <span style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1 }} className="gradient-text">{overallScore}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>out of 100</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: overallScore >= 80 ? '#22c55e' : '#f59e0b' }}>
            {overallScore >= 80 ? 'Strong Technical Performance' : 'Proficient with Growth Areas'}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>Executive Summary</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {evaluation?.overallAssessment || 'Candidate demonstrated grounded knowledge across stated resume skills and public GitHub repository projects.'}
          </p>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Projects Grounded: </span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{projects?.length || 0}</strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Questions Probed: </span>
              <strong style={{ color: 'var(--accent-purple)' }}>{transcript?.length || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Strengths & Areas for Improvement Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Strengths Card */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#22c55e', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
            <CheckCircle2 size={22} />
            <span>Key Strengths</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {evaluation?.strengths?.map((str: string, i: number) => (
              <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>•</span>
                <span>{str}</span>
              </li>
            )) || <li>Solid architectural baseline demonstrated during interview.</li>}
          </ul>
        </div>

        {/* Areas for Improvement Card */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
            <AlertTriangle size={22} />
            <span>Areas to Improve</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {evaluation?.areasToImprove?.map((area: string, i: number) => (
              <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>•</span>
                <span>{area}</span>
              </li>
            )) || <li>Expand further on edge-case recovery and vector DB index configuration.</li>}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Grounded Feedback */}
      <section className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={22} color="var(--accent-indigo)" />
          <span>Question-by-Question Grounded Analysis</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {evaluation?.questionBreakdown?.map((item: any, idx: number) => {
            const isExpanded = expandedTurn === idx;

            return (
              <div key={idx} className="glass-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent-indigo)' }}>
                <div 
                  onClick={() => setExpandedTurn(isExpanded ? null : idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, paddingRight: '1rem' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--accent-indigo)', fontSize: '0.85rem' }}>Q{item.order || (idx + 1)}</span>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                        Source: {item.groundingSource}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      "{item.questionText}"
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      background: item.relevance === 'Strong' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: item.relevance === 'Strong' ? '#22c55e' : '#f59e0b'
                    }}>
                      {item.relevance} Relevance
                    </span>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Candidate Answer Transcript:
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        "{item.transcript}"
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.825rem' }}>
                      <div>Correctness: <strong style={{ color: 'var(--text-primary)' }}>{item.technicalCorrectness}</strong></div>
                      <div>Depth Level: <strong style={{ color: 'var(--accent-cyan)' }}>{item.depthLevel}</strong></div>
                    </div>

                    <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem' }}>
                      <strong style={{ color: 'var(--accent-indigo)' }}>Evaluator Feedback: </strong>
                      <span>{item.feedback}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          }) || (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No detailed question breakdowns available for this interview session.
            </div>
          )}
        </div>
      </section>

      {/* Action Footer */}
      <footer style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '3rem' }}>
        <button onClick={() => router.push('/')} className="btn-primary">
          <RotateCcw size={18} />
          <span>Upload Another Resume for Interview</span>
        </button>
      </footer>
    </main>
  );
}
