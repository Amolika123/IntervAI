'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  Cpu,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  HelpCircle,
  XCircle,
  Lightbulb
} from 'lucide-react';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';
import { INSUFFICIENT_EVIDENCE_ASSESSMENT } from '@/lib/interviewer/interviewConfig';

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

        // Lifecycle: Results successfully loaded in browser -> Purge temporary question bank
        fetch(`/api/interview/${interviewId}/cleanup`, { method: 'POST' }).catch((e) => {
          console.debug('Temporary question bank cleanup notice:', e);
        });
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
            Analyzing candidate responses against grounding sources and deterministic rubric metrics.
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
  const overallScore: number = evaluation?.overallScore ?? 0;
  const isInsufficientEvidence =
    overallScore === 0 ||
    (evaluation?.overallAssessment && evaluation.overallAssessment.includes(INSUFFICIENT_EVIDENCE_ASSESSMENT));

  const activeStyleKey = (data?.interview?.style || 'FAANG') as InterviewStyleId;
  const styleConfig = INTERVIEW_STYLES[activeStyleKey] || INTERVIEW_STYLES.FAANG;

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'timed_out':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Clock size={12} />
            Timed Out
          </span>
        );
      case 'unanswered':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#ef4444',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <XCircle size={12} />
            Unanswered
          </span>
        );
      case 'transcription_failed':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            color: '#a855f7',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <HelpCircle size={12} />
            Audio Failed
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#22c55e',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <CheckCircle2 size={12} />
            Answered
          </span>
        );
    }
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2.5rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button onClick={() => router.push('/')} className="btn-secondary" style={{ marginBottom: '0.75rem', padding: '8px 14px', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} />
            <span>Start New Interview</span>
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>
            Technical Evaluation Report <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {candidate?.name}</span>
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Interview Style Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: `${styleConfig.color}15`,
            border: `1px solid ${styleConfig.color}45`,
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            color: styleConfig.color,
            fontWeight: 600,
          }}>
            <Layers size={16} />
            <span>{styleConfig.name} Style Preset</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(99, 102, 241, 0.1)', padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.85rem', color: 'var(--accent-indigo)' }}>
            <Sparkles size={16} />
            <span>Deterministic Rubric Calibration</span>
          </div>
        </div>
      </header>

      {/* Hero Score Badge Panel */}
      <div className="glass-panel" style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: '220px 1fr', gap: '2.5rem', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '2rem' }}>
          <div style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            background: isInsufficientEvidence ? 'rgba(239, 68, 68, 0.1)' : 'var(--gradient-glow)',
            border: `4px solid ${isInsufficientEvidence ? '#ef4444' : overallScore >= 75 ? 'var(--accent-indigo)' : '#f59e0b'}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto',
            boxShadow: isInsufficientEvidence ? '0 0 25px rgba(239, 68, 68, 0.25)' : '0 0 35px rgba(99, 102, 241, 0.3)'
          }}>
            <span style={{ fontSize: '2.8rem', fontWeight: 800, lineHeight: 1 }} className={isInsufficientEvidence ? '' : 'gradient-text'}>
              {overallScore}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>out of 100</span>
          </div>
          <div style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: isInsufficientEvidence ? '#ef4444' : overallScore >= 75 ? '#22c55e' : '#f59e0b'
          }}>
            {isInsufficientEvidence
              ? 'Insufficient Evidence'
              : overallScore >= 75
              ? 'Strong Technical Performance'
              : 'Proficient with Growth Areas'}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.75rem' }}>Executive Summary</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.975rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {evaluation?.overallAssessment || (isInsufficientEvidence
              ? INSUFFICIENT_EVIDENCE_ASSESSMENT
              : 'Candidate completed the technical evaluation.')}
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Projects Grounded: </span>
              <strong style={{ color: 'var(--accent-cyan)' }}>{projects?.length || 0}</strong>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Questions Asked: </span>
              <strong style={{ color: 'var(--accent-purple)' }}>{transcript?.length || 0}</strong>
            </div>
            <div style={{ background: `${styleConfig.color}10`, padding: '8px 14px', borderRadius: '10px', border: `1px solid ${styleConfig.color}35`, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Interview Style: </span>
              <strong style={{ color: styleConfig.color }}>{styleConfig.name}</strong>
            </div>
          </div>

          {/* Transparent Scoring Formula Notice */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: `1px solid ${styleConfig.color}25`,
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, color: styleConfig.color }}>Deterministic Rubric Weights:</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Technical Correctness (40%) • Completeness (25%) • Technical Depth (20%) • Relevance (15%)
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Overall score is computed deterministically across all asked questions. Unanswered or timed-out questions count as 0/100.
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
            {evaluation?.strengths && evaluation.strengths.length > 0 ? (
              evaluation.strengths.map((str: string, i: number) => (
                <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>•</span>
                  <span>{str}</span>
                </li>
              ))
            ) : (
              <li style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                No demonstrable strengths recorded due to absence of valid answers.
              </li>
            )}
          </ul>
        </div>

        {/* Areas for Improvement Card */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem' }}>
            <AlertTriangle size={22} />
            <span>Areas to Improve</span>
          </div>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {evaluation?.areasToImprove && evaluation.areasToImprove.length > 0 ? (
              evaluation.areasToImprove.map((area: string, i: number) => (
                <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>•</span>
                  <span>{area}</span>
                </li>
              ))
            ) : (
              <li style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                Ensure microphone is active and provide answers within the per-question time limit.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Question-by-Question Grounded Feedback */}
      <section className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <FileText size={22} color="var(--accent-indigo)" />
          <span>Question-by-Question Rubric Breakdown</span>
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {evaluation?.questionBreakdown?.map((item: any, idx: number) => {
            const isExpanded = expandedTurn === idx;
            const qScore = item.questionScore ?? 0;

            return (
              <div
                key={idx}
                className="glass-card"
                style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${item.status && item.status !== 'answered' ? '#ef4444' : qScore >= 70 ? '#22c55e' : '#f59e0b'}`
                }}
              >
                <div 
                  onClick={() => setExpandedTurn(isExpanded ? null : idx)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: '1rem' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--accent-indigo)', fontSize: '0.85rem' }}>
                        Q{item.order || (idx + 1)}
                      </span>
                      {renderStatusBadge(item.status)}
                      <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-muted)' }}>
                        Source: {item.groundingSource}
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                      "{item.questionText}"
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Deterministic Question Score Pill */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      lineHeight: 1.1
                    }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Score</span>
                      <span style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: qScore >= 70 ? '#22c55e' : qScore > 0 ? '#f59e0b' : '#ef4444'
                      }}>
                        {qScore}/100
                      </span>
                    </div>

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
                      <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{item.transcript || '[No response recorded]'}"
                      </div>
                    </div>

                    {/* 4 Rubric Dimensions Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Technical Correctness (40%):</div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {item.technicalCorrectnessScore ?? 0}/100
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Completeness (25%):</div>
                        <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.9rem' }}>
                          {item.completenessScore ?? 0}/100
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Technical Depth (20%):</div>
                        <strong style={{ color: 'var(--accent-purple)', fontSize: '0.9rem' }}>
                          {item.depthLevelScore ?? 0}/100
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)' }}>Relevance (15%):</div>
                        <strong style={{ color: 'var(--accent-indigo)', fontSize: '0.9rem' }}>
                          {item.relevanceScore ?? 0}/100
                        </strong>
                      </div>
                    </div>

                    {/* Evaluator Feedback */}
                    <div style={{ background: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem' }}>
                      <strong style={{ color: 'var(--accent-indigo)' }}>Evaluator Assessment: </strong>
                      <span>{item.feedback}</span>
                    </div>

                    {/* Suggested Improvement */}
                    {item.suggestedImprovement && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <Lightbulb size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ color: '#f59e0b' }}>Suggested Improvement: </strong>
                          <span>{item.suggestedImprovement}</span>
                        </div>
                      </div>
                    )}
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
