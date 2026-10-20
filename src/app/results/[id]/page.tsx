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
  Lightbulb,
  Building2,
  FolderGit2,
  HelpCircle as QuestionIcon,
} from 'lucide-react';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';
import { INSUFFICIENT_EVIDENCE_ASSESSMENT } from '@/lib/interviewer/interviewConfig';
import PageShell from '@/components/layout/PageShell';

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
      <PageShell title="Evaluation Report">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '480px', padding: '2rem' }}>
            <Cpu size={52} style={{ color: 'var(--accent-cyan)', animation: 'spin 1.5s linear infinite', marginBottom: '1.25rem' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Synthesizing Technical Evaluation...
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.82)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Evaluating candidate spoken responses against grounded resume projects and deterministic 4-dimensional rubric criteria.
            </p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (error || !data) {
    return (
      <PageShell title="Evaluation Report">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '520px', width: '100%' }}>
            <AlertTriangle size={44} color="#ef4444" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem', color: '#ffffff' }}>
              Unable to Load Results
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.82)', fontSize: '0.9375rem', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              {error}
            </p>
            <button onClick={() => router.push('/')} className="btn-primary" style={{ margin: '0 auto' }}>
              <ArrowLeft size={16} />
              <span>Return to Home</span>
            </button>
          </div>
        </div>
      </PageShell>
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
            padding: '3px 9px',
            borderRadius: '9999px',
            background: 'rgba(245, 158, 11, 0.18)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
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
            padding: '3px 9px',
            borderRadius: '9999px',
            background: 'rgba(239, 68, 68, 0.18)',
            border: '1px solid rgba(239, 68, 68, 0.45)',
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
            padding: '3px 9px',
            borderRadius: '9999px',
            background: 'rgba(245, 158, 11, 0.18)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            color: '#f59e0b',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <HelpCircle size={12} />
            Audio Not Detected
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: '9999px',
            background: 'rgba(34, 197, 94, 0.18)',
            border: '1px solid rgba(34, 197, 94, 0.45)',
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
    <PageShell
      title="Technical Evaluation Report"
      maxWidth="1160px"
      rightAction={
        <button
          onClick={() => router.push('/')}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          id="btn-start-new-interview"
        >
          <RotateCcw size={15} />
          <span>Start New Interview</span>
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Top Context Subheader */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              <Award size={15} />
              <span>Verified AI Evaluation</span>
            </div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.25rem)', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Technical Evaluation Report
              <span style={{ color: 'rgba(255, 255, 255, 0.65)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.85em' }}>
                • {candidate?.name || 'Candidate'}
              </span>
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Style Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(0, 217, 255, 0.35)',
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              color: '#ffffff',
              fontWeight: 600,
            }}>
              <Layers size={14} color="var(--accent-cyan)" />
              <span>{styleConfig.name} Style Preset</span>
            </div>

            {/* Rubric Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(0, 105, 233, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              padding: '7px 14px',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 600,
            }}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              <span>Deterministic Rubric Calibration</span>
            </div>
          </div>
        </div>

        {/* Hero Score Badge Panel */}
        <section className="glass-panel results-hero-grid" style={{ padding: '2.25rem' }}>
          {/* Left: Overall Score Dial */}
          <div className="results-hero-score-col">
            <div
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                background: isInsufficientEvidence
                  ? 'rgba(239, 68, 68, 0.14)'
                  : overallScore >= 75
                  ? 'radial-gradient(circle, rgba(0, 217, 255, 0.22) 0%, rgba(5, 91, 211, 0.45) 100%)'
                  : 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(5, 91, 211, 0.45) 100%)',
                border: `4px solid ${
                  isInsufficientEvidence
                    ? '#ef4444'
                    : overallScore >= 75
                    ? '#00d9ff'
                    : '#f59e0b'
                }`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                boxShadow: isInsufficientEvidence
                  ? '0 0 35px rgba(239, 68, 68, 0.35)'
                  : overallScore >= 75
                  ? '0 0 35px rgba(0, 217, 255, 0.45)'
                  : '0 0 35px rgba(245, 158, 11, 0.35)',
              }}
            >
              <span
                style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: isInsufficientEvidence
                    ? '#ef4444'
                    : overallScore >= 75
                    ? '#00d9ff'
                    : '#f59e0b',
                }}
              >
                {overallScore}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'rgba(255, 255, 255, 0.65)',
                  marginTop: '4px',
                }}
              >
                out of 100
              </span>
            </div>

            <div
              style={{
                fontWeight: 800,
                fontSize: '1rem',
                color: isInsufficientEvidence
                  ? '#ef4444'
                  : overallScore >= 75
                  ? '#22c55e'
                  : '#f59e0b',
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              {isInsufficientEvidence
                ? 'Insufficient Evidence'
                : overallScore >= 75
                ? 'Strong Technical Performance'
                : 'Proficient with Growth Areas'}
            </div>
          </div>

          {/* Right: Executive Summary & Details */}
          <div className="results-hero-details-col">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.65rem' }}>
              Executive Summary
            </h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.88)', fontSize: '0.975rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {evaluation?.overallAssessment ||
                (isInsufficientEvidence
                  ? INSUFFICIENT_EVIDENCE_ASSESSMENT
                  : 'Candidate completed the technical evaluation.')}
            </p>

            {/* Insufficient Evidence Notice */}
            {isInsufficientEvidence && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
                  <strong style={{ color: '#ef4444' }}>No valid answers were recorded: </strong>
                  Spoken responses were either silent, timed out, or not captured by speech recognition. Deterministic scoring requires valid candidate answers to award technical points.
                </div>
              </div>
            )}

            {/* Grounding & Style Meta Pills */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Projects Grounded: </span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{projects?.length || 0}</strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Questions Asked: </span>
                <strong style={{ color: '#ffffff' }}>{transcript?.length || 0}</strong>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.65)' }}>Interview Style: </span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{styleConfig.name} ({styleConfig.badge})</strong>
              </div>
            </div>

            {/* Transparent Scoring Formula Notice */}
            <div
              style={{
                background: 'rgba(5, 65, 153, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '0.85rem',
                lineHeight: 1.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: 'var(--accent-cyan)' }}>Deterministic Rubric Weights:</span>
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.8rem' }}>
                  Technical Correctness (40%) • Completeness (25%) • Technical Depth (20%) • Relevance (15%)
                </span>
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Overall score is computed deterministically across all asked questions. Unanswered or timed-out questions count as 0/100.
              </div>
            </div>
          </div>
        </section>

        {/* Strengths & Areas for Improvement Grid */}
        <section className="results-feedback-grid">
          {/* Key Strengths */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#22c55e', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.1rem' }}>
              <CheckCircle2 size={22} />
              <span>Key Strengths</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', padding: 0, margin: 0 }}>
              {evaluation?.strengths && evaluation.strengths.length > 0 ? (
                evaluation.strengths.map((str: string, i: number) => (
                  <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'rgba(255, 255, 255, 0.88)', lineHeight: 1.5 }}>
                    <span style={{ color: '#22c55e', fontWeight: 800 }}>•</span>
                    <span>{str}</span>
                  </li>
                ))
              ) : (
                <li style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No demonstrable strengths recorded due to absence of valid answers.
                </li>
              )}
            </ul>
          </div>

          {/* Areas to Improve */}
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', fontWeight: 800, fontSize: '1.15rem', marginBottom: '1.1rem' }}>
              <AlertTriangle size={22} />
              <span>Areas to Improve</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', padding: 0, margin: 0 }}>
              {evaluation?.areasToImprove && evaluation.areasToImprove.length > 0 ? (
                evaluation.areasToImprove.map((area: string, i: number) => (
                  <li key={i} style={{ display: 'flex', gap: '10px', fontSize: '0.925rem', color: 'rgba(255, 255, 255, 0.88)', lineHeight: 1.5 }}>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>•</span>
                    <span>{area}</span>
                  </li>
                ))
              ) : (
                <li style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  Ensure microphone is active and provide answers within the per-question time limit.
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* Question-by-Question Grounded Feedback */}
        <section className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={22} color="var(--accent-cyan)" />
            <span>Question-by-Question Rubric Breakdown</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {evaluation?.questionBreakdown?.map((item: any, idx: number) => {
              const isExpanded = expandedTurn === idx;
              const qScore = item.questionScore ?? 0;
              const isNonAnswer = item.status && item.status !== 'answered';

              return (
                <div
                  key={idx}
                  className="glass-card"
                  style={{
                    padding: '1.35rem',
                    borderLeft: `4px solid ${
                      isNonAnswer
                        ? '#ef4444'
                        : qScore >= 70
                        ? '#22c55e'
                        : '#f59e0b'
                    }`,
                    borderRadius: '12px',
                    transition: 'border-color 200ms ease, background 200ms ease',
                  }}
                >
                  <div
                    onClick={() => setExpandedTurn(isExpanded ? null : idx)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: '1rem' }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedTurn(isExpanded ? null : idx);
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: 'var(--accent-cyan)', fontSize: '0.85rem', letterSpacing: '0.04em' }}>
                          Q{item.order || (idx + 1)}
                        </span>
                        {renderStatusBadge(item.status)}
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '6px', color: 'rgba(255, 255, 255, 0.7)' }}>
                          Source: {item.groundingSource}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.025rem', color: '#ffffff', lineHeight: 1.45 }}>
                        "{item.questionText}"
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                      {/* Deterministic Question Score Pill */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.65)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                          Score
                        </span>
                        <span
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            color: qScore >= 70 ? '#22c55e' : qScore > 0 ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          {qScore}/100
                        </span>
                      </div>

                      <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                          Candidate Answer Transcript:
                        </div>
                        <div style={{ background: 'rgba(0, 20, 50, 0.45)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.925rem', fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5 }}>
                          "{item.transcript || '[No response recorded]'}"
                        </div>
                      </div>

                      {/* 4 Rubric Dimensions Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '10px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          padding: '14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '0.8125rem' }}>
                          <div style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '2px' }}>Technical Correctness (40%):</div>
                          <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>
                            {item.technicalCorrectnessScore ?? 0}/100
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.8125rem' }}>
                          <div style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '2px' }}>Completeness (25%):</div>
                          <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                            {item.completenessScore ?? 0}/100
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.8125rem' }}>
                          <div style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '2px' }}>Technical Depth (20%):</div>
                          <strong style={{ color: '#ffffff', fontSize: '0.95rem' }}>
                            {item.depthLevelScore ?? 0}/100
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.8125rem' }}>
                          <div style={{ color: 'rgba(255, 255, 255, 0.65)', marginBottom: '2px' }}>Relevance (15%):</div>
                          <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                            {item.relevanceScore ?? 0}/100
                          </strong>
                        </div>
                      </div>

                      {/* Evaluator Feedback */}
                      <div style={{ background: 'rgba(0, 105, 233, 0.16)', border: '1px solid rgba(0, 217, 255, 0.25)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.925rem', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--accent-cyan)' }}>Evaluator Assessment: </strong>
                        <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{item.feedback}</span>
                      </div>

                      {/* Suggested Improvement */}
                      {item.suggestedImprovement && (
                        <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.925rem', display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: 1.5 }}>
                          <Lightbulb size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                          <div>
                            <strong style={{ color: '#f59e0b' }}>Suggested Improvement: </strong>
                            <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>{item.suggestedImprovement}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }) || (
              <div style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.925rem', textAlign: 'center', padding: '2rem' }}>
                No detailed question breakdowns available for this interview session.
              </div>
            )}
          </div>
        </section>

        {/* Action Footer */}
        <footer style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
            style={{ padding: '14px 28px', fontSize: '1rem', margin: '0 auto' }}
          >
            <RotateCcw size={18} />
            <span>Upload Another Resume for Interview</span>
          </button>
        </footer>
      </div>

      <style jsx>{`
        .results-hero-grid {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 2.5rem;
          align-items: center;
        }

        .results-hero-score-col {
          text-align: center;
          border-right: 1px solid rgba(255, 255, 255, 0.14);
          padding-right: 2rem;
        }

        .results-feedback-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 860px) {
          .results-hero-grid {
            grid-template-columns: 1fr;
            gap: 1.75rem;
          }
          .results-hero-score-col {
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.14);
            padding-right: 0;
            padding-bottom: 1.75rem;
          }
          .results-feedback-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

