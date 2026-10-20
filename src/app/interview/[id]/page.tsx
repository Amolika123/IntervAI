'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  Clock,
  Sparkles,
  Send,
  Bot,
  User,
  VolumeX,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  Code2,
  Zap,
  Building2,
  Timer
} from 'lucide-react';
import { SpeechEngine, VoiceState } from '@/lib/voice/speechEngine';
import { INTERVIEW_STYLES, InterviewStyleId } from '@/lib/interviewer/styles';
import {
  TOTAL_INTERVIEW_DURATION_SECONDS,
  TOTAL_WARNING_5MIN_SECONDS,
  TOTAL_WARNING_1MIN_SECONDS,
  TOTAL_WARNING_10SEC_SECONDS,
  PER_QUESTION_DURATION_SECONDS,
  QUESTION_WARNING_15SEC_SECONDS,
  QUESTION_WARNING_5SEC_SECONDS,
  AnswerStatus
} from '@/lib/interviewer/interviewConfig';

interface LiveInterviewProps {
  params: Promise<{ id: string }>;
}

interface TranscriptTurn {
  order: number;
  speaker: 'AI' | 'Candidate';
  text: string;
  status?: AnswerStatus;
  groundingSource?: string;
}

export default function LiveInterviewPage({ params }: LiveInterviewProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const interviewId = resolvedParams.id;

  // Session & Voice States
  const [candidateName, setCandidateName] = useState<string>('Candidate');
  const [projects, setProjects] = useState<any[]>([]);
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyleId>('FAANG');
  const [voiceState, setVoiceState] = useState<VoiceState>('READY_TO_START');
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [interimSpeechText, setInterimSpeechText] = useState<string>('');
  const [isEnding, setIsEnding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAccessibilityText, setShowAccessibilityText] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>('');

  // Timers State
  const [totalRemainingSeconds, setTotalRemainingSeconds] = useState<number>(TOTAL_INTERVIEW_DURATION_SECONDS);
  const [questionRemainingSeconds, setQuestionRemainingSeconds] = useState<number>(PER_QUESTION_DURATION_SECONDS);
  const [isQuestionTimerActive, setIsQuestionTimerActive] = useState<boolean>(false);

  // Transcript & Grounding State
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentQuestionOrder, setCurrentQuestionOrder] = useState<number>(1);
  const [activeGroundingSource, setActiveGroundingSource] = useState<string>('resume:project_1');
  const [openingQuestionText, setOpeningQuestionText] = useState<string>('');

  // Engine & Timing References
  const speechEngineRef = useRef<SpeechEngine | null>(null);
  const totalTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const totalDeadlineRef = useRef<number | null>(null);

  const questionTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const questionDeadlineRef = useRef<number | null>(null);

  const isSubmittingRef = useRef<boolean>(false);
  const isEndingRef = useRef<boolean>(false);
  const currentQuestionOrderRef = useRef<number>(1);
  const activeGroundingSourceRef = useRef<string>('resume:project_1');
  const lastQuestionTextRef = useRef<string>('');

  // Synchronize state to refs
  useEffect(() => {
    currentQuestionOrderRef.current = currentQuestionOrder;
  }, [currentQuestionOrder]);

  useEffect(() => {
    activeGroundingSourceRef.current = activeGroundingSource;
  }, [activeGroundingSource]);

  // Clean up all timers and intervals
  const clearAllTimers = () => {
    if (totalTimerIntervalRef.current) {
      clearInterval(totalTimerIntervalRef.current);
      totalTimerIntervalRef.current = null;
    }
    if (questionTimerIntervalRef.current) {
      clearInterval(questionTimerIntervalRef.current);
      questionTimerIntervalRef.current = null;
    }
  };

  const stopQuestionTimer = () => {
    questionDeadlineRef.current = null;
    setIsQuestionTimerActive(false);
    if (questionTimerIntervalRef.current) {
      clearInterval(questionTimerIntervalRef.current);
      questionTimerIntervalRef.current = null;
    }
  };

  const startQuestionTimer = () => {
    if (isEndingRef.current) return;
    stopQuestionTimer();

    questionDeadlineRef.current = Date.now() + PER_QUESTION_DURATION_SECONDS * 1000;
    setQuestionRemainingSeconds(PER_QUESTION_DURATION_SECONDS);
    setIsQuestionTimerActive(true);

    questionTimerIntervalRef.current = setInterval(() => {
      if (!questionDeadlineRef.current || isEndingRef.current) return;
      const remainingMs = questionDeadlineRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setQuestionRemainingSeconds(remainingSec);

      if (remainingSec <= 0) {
        stopQuestionTimer();
        handleQuestionTimeout();
      }
    }, 500);
  };

  // Initialize Session Data
  useEffect(() => {
    let isMounted = true;

    const engine = new SpeechEngine({
      onStateChange: (state) => {
        if (isMounted) setVoiceState(state);
      },
      onInterimTranscript: (text) => {
        if (isMounted) setInterimSpeechText(text);
      },
      onFinalTranscript: (finalText) => {
        if (isMounted && finalText.trim().length > 0) {
          handleCandidateFinalAnswer(finalText.trim(), 'answered');
        }
      },
      onAISpeechEnd: () => {
        // Start per-question timer ONLY after AI finishes speaking aloud
        if (isMounted && !isEndingRef.current) {
          startQuestionTimer();
        }
      },
      onError: (msg) => {
        if (isMounted) {
          setErrorMessage(msg);
          setVoiceState('ERROR');
        }
      }
    });

    speechEngineRef.current = engine;

    async function loadInterviewData() {
      try {
        const sessionRes = await fetch('/api/interview/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interviewId })
        });

        const sessionData = await sessionRes.json();

        const resolvedStyle: InterviewStyleId =
          sessionData.style && sessionData.style in INTERVIEW_STYLES
            ? (sessionData.style as InterviewStyleId)
            : 'FAANG';

        if (isMounted) {
          setInterviewStyle(resolvedStyle);
        }

        const name = sessionData.candidateContext?.candidate?.name || 'Candidate';
        if (sessionData.candidateContext?.candidate?.name) {
          setCandidateName(name);
        }

        let pList: any[] = [];
        if (sessionData.candidateContext?.projects) {
          pList = sessionData.candidateContext.projects;
          setProjects(pList);
          const firstProj = pList[0];
          if (firstProj) {
            const src = `project:${firstProj.name}:${firstProj.contextSource}`;
            setActiveGroundingSource(src);
            activeGroundingSourceRef.current = src;
          }
        }

        const p1 = pList[0];
        const openingQ = sessionData.openingQuestion || (
          resolvedStyle === 'FAANG'
            ? (p1 ? `Hello ${name}. Let's dive into ${p1.name}. Can you walk me through the core implementation details and the primary data structures you used?` : `Hello ${name}. Can you walk me through the primary technical project on your resume?`)
            : resolvedStyle === 'MANGOS'
            ? (p1 ? `Hello ${name}. Let's discuss ${p1.name}. Can you walk me through the high-level architecture and the fundamental design trade-offs you made?` : `Hello ${name}. Can you walk me through your primary technical project on your resume?`)
            : (p1 ? `Hello ${name}. Let's examine ${p1.name}. Can you walk me through its practical implementation, focusing on your APIs, databases, and application architecture?` : `Hello ${name}. Can you walk me through your primary technical project?`)
        );

        const openingSrc = sessionData.openingSource || (p1 ? `project:${p1.name}:${p1.contextSource}` : 'resume:project_overview');

        if (isMounted) {
          setOpeningQuestionText(openingQ);
          lastQuestionTextRef.current = openingQ;
          setActiveGroundingSource(openingSrc);
          activeGroundingSourceRef.current = openingSrc;
          setTranscript([
            { order: 1, speaker: 'AI', text: openingQ, groundingSource: openingSrc }
          ]);
        }
      } catch (e) {
        console.error('Failed to load session data:', e);
        if (isMounted) {
          setErrorMessage('Failed to connect to interview session.');
          setVoiceState('ERROR');
        }
      }
    }

    loadInterviewData();

    return () => {
      isMounted = false;
      clearAllTimers();
      if (speechEngineRef.current) speechEngineRef.current.destroy();
    };
  }, [interviewId]);

  // Start Voice Session Handler: Unlocks Audio Context, Starts Total Countdown, Speaks Opening Q
  const handleStartVoiceSession = async () => {
    if (!speechEngineRef.current) return;

    speechEngineRef.current.unlockAudioContext();
    setSessionStarted(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn('Microphone permission denied:', err);
      setMicGranted(false);
    }

    // Start Total Interview Countdown (40 minutes)
    totalDeadlineRef.current = Date.now() + TOTAL_INTERVIEW_DURATION_SECONDS * 1000;
    setTotalRemainingSeconds(TOTAL_INTERVIEW_DURATION_SECONDS);

    totalTimerIntervalRef.current = setInterval(() => {
      if (!totalDeadlineRef.current || isEndingRef.current) return;
      const remainingMs = totalDeadlineRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTotalRemainingSeconds(remainingSec);

      if (remainingSec <= 0) {
        handleTotalInterviewTimeout();
      }
    }, 500);

    // AI Speaks opening question aloud (Question timer begins on onAISpeechEnd)
    await speechEngineRef.current.speakAIQuestion(openingQuestionText);
  };

  // Handler for Question Timer Expiration (90s limit)
  const handleQuestionTimeout = () => {
    if (isEndingRef.current || isSubmittingRef.current) return;

    // Check if candidate had any partial spoken words
    const spoken = speechEngineRef.current?.getCurrentTranscript() || '';
    if (spoken.trim().length > 0) {
      handleCandidateFinalAnswer(spoken.trim(), 'timed_out');
    } else {
      handleCandidateFinalAnswer('', 'timed_out');
    }
  };

  // Handler for Total Interview Timer Expiration (40 mins limit)
  const handleTotalInterviewTimeout = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    clearAllTimers();

    // Check if candidate was speaking when total time expired
    const inProgress = speechEngineRef.current?.getCurrentTranscript() || '';
    if (inProgress.trim().length > 0 && !isSubmittingRef.current) {
      try {
        await fetch('/api/interview/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interviewId,
            order: currentQuestionOrderRef.current,
            questionText: lastQuestionTextRef.current || 'Technical interview question',
            groundingSource: activeGroundingSourceRef.current,
            transcript: inProgress.trim(),
            status: 'answered'
          })
        });
      } catch (e) {
        console.warn('Final in-progress turn save notice:', e);
      }
    }

    await handleEndInterview();
  };

  // Candidate Final Answer Handler (VAD auto-submit, timeout, or manual button click)
  const handleCandidateFinalAnswer = async (answerText: string, status: AnswerStatus = 'answered') => {
    if (isSubmittingRef.current || isEndingRef.current) return;
    isSubmittingRef.current = true;

    stopQuestionTimer();
    setVoiceState('PROCESSING_ANSWER');
    setInterimSpeechText('');

    const questionText = lastQuestionTextRef.current || 'Technical question';
    const currentOrder = currentQuestionOrderRef.current;
    const finalAnswerDisplay = answerText.trim() || (status === 'timed_out' ? '[Time expired without answer]' : '[Unanswered]');

    setTranscript((prev) => [
      ...prev,
      { order: currentOrder, speaker: 'Candidate', text: finalAnswerDisplay, status }
    ]);

    // Save turn to backend DB and receive next non-repetitive grounded question from question bank
    let backendNextQ = '';
    let backendNextSource = activeGroundingSourceRef.current;
    let backendNextOrder = currentOrder + 1;

    try {
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          order: currentOrder,
          questionText,
          groundingSource: activeGroundingSourceRef.current,
          transcript: answerText.trim(),
          status
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.nextQuestion) backendNextQ = data.nextQuestion;
        if (data.nextGroundingSource) backendNextSource = data.nextGroundingSource;
        if (data.nextOrder) backendNextOrder = data.nextOrder;
      }
    } catch (e) {
      console.error('Failed to persist turn or retrieve next question:', e);
    }

    // Check if total interview expired while processing answer
    if (isEndingRef.current || totalRemainingSeconds <= 0) {
      isSubmittingRef.current = false;
      await handleEndInterview();
      return;
    }

    setCurrentQuestionOrder(backendNextOrder);
    setVoiceState('GENERATING_NEXT_QUESTION');

    // Dynamic Style-Grounded Follow-up logic
    setTimeout(async () => {
      if (isEndingRef.current) {
        isSubmittingRef.current = false;
        return;
      }

      let nextQ = backendNextQ;
      let nextSource = backendNextSource;

      // Fallback only if backend did not return nextQuestion
      if (!nextQ) {
        const p1 = projects[0];
        if (interviewStyle === 'FAANG') {
          nextQ = p1
            ? `In ${p1.name}, what were the main computational bottlenecks and how did you analyze algorithmic complexity?`
            : `Can you walk me through the algorithmic trade-offs of the systems you implemented?`;
          nextSource = p1 ? `project:${p1.name}:complexity` : 'resume:skills:complexity';
        } else if (interviewStyle === 'MANGOS') {
          nextQ = p1
            ? `What alternative system architectures did you consider for ${p1.name}, and why select this stack?`
            : `Can you walk me through the system design trade-offs and failure scenarios of the architectures you built?`;
          nextSource = p1 ? `project:${p1.name}:architecture` : 'resume:skills:architecture';
        } else {
          nextQ = p1
            ? `How did you design the database schemas, indexing, and APIs in ${p1.name} to ensure reliability?`
            : `How did you structure database schemas and API contracts across your technical projects?`;
          nextSource = p1 ? `project:${p1.name}:databases` : 'resume:skills:databases';
        }
      }

      lastQuestionTextRef.current = nextQ;
      setActiveGroundingSource(nextSource);
      activeGroundingSourceRef.current = nextSource;

      setTranscript((prev) => [
        ...prev,
        { order: backendNextOrder, speaker: 'AI', text: nextQ, groundingSource: nextSource }
      ]);

      isSubmittingRef.current = false;

      if (speechEngineRef.current && !isEndingRef.current) {
        await speechEngineRef.current.speakAIQuestion(nextQ);
      }
    }, 700);
  };

  const handleInterruptAI = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
      speechEngineRef.current.startListening();
      // Start question timer immediately upon interruption
      startQuestionTimer();
    }
  };

  const handleManualStartListening = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.startListening();
      if (!isQuestionTimerActive) {
        startQuestionTimer();
      }
    }
  };

  const handleEndInterview = async () => {
    if (isEnding) return;
    setIsEnding(true);
    isEndingRef.current = true;
    clearAllTimers();
    setVoiceState('INTERVIEW_ENDED');

    if (speechEngineRef.current) {
      speechEngineRef.current.destroy();
    }

    try {
      await fetch('/api/interview/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId })
      });
      router.push(`/results/${interviewId}`);
    } catch (e) {
      console.error('Error concluding interview:', e);
      router.push(`/results/${interviewId}`);
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStyleConfig = INTERVIEW_STYLES[interviewStyle] || INTERVIEW_STYLES.FAANG;

  const renderVoiceStateBanner = () => {
    switch (voiceState) {
      case 'AI_SPEAKING':
        return { label: `IntervAI is speaking (${currentStyleConfig.name} style)...`, color: currentStyleConfig.color, icon: <Volume2 size={20} /> };
      case 'LISTENING':
        return { label: 'Listening to you... Speak your answer into microphone', color: '#22c55e', icon: <Mic size={20} /> };
      case 'PROCESSING_ANSWER':
        return { label: 'Analyzing candidate answer against rubric...', color: 'var(--accent-purple)', icon: <RefreshCw size={20} className="spin" /> };
      case 'GENERATING_NEXT_QUESTION':
        return { label: `Formulating ${currentStyleConfig.name} follow-up question...`, color: 'var(--accent-indigo)', icon: <Sparkles size={20} /> };
      case 'INTERVIEW_ENDED':
        return { label: 'Interview concluding. Finalizing evaluation...', color: 'var(--accent-cyan)', icon: <RefreshCw size={20} className="spin" /> };
      case 'ERROR':
        return { label: errorMessage || 'Microphone error', color: '#f87171', icon: <AlertCircle size={20} /> };
      default:
        return { label: `Ready to Start (${currentStyleConfig.name} Style)`, color: currentStyleConfig.color, icon: <Play size={20} /> };
    }
  };

  const stateBanner = renderVoiceStateBanner();

  // Total Timer Warning Thresholds
  const isTotalWarning10Sec = totalRemainingSeconds <= TOTAL_WARNING_10SEC_SECONDS && totalRemainingSeconds > 0;
  const isTotalWarning1Min = totalRemainingSeconds <= TOTAL_WARNING_1MIN_SECONDS && !isTotalWarning10Sec;
  const isTotalWarning5Min = totalRemainingSeconds <= TOTAL_WARNING_5MIN_SECONDS && !isTotalWarning1Min && !isTotalWarning10Sec;

  // Question Timer Warning Thresholds
  const isQuestionWarning5Sec = questionRemainingSeconds <= QUESTION_WARNING_5SEC_SECONDS && isQuestionTimerActive;
  const isQuestionWarning15Sec = questionRemainingSeconds <= QUESTION_WARNING_15SEC_SECONDS && !isQuestionWarning5Sec && isQuestionTimerActive;

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Navigation Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: stateBanner.color,
            boxShadow: `0 0 12px ${stateBanner.color}`
          }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            Live Voice Technical Interview <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>• {candidateName}</span>
          </span>

          {/* Active Style Badge in Header */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: `${currentStyleConfig.color}15`,
            border: `1px solid ${currentStyleConfig.color}40`,
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: currentStyleConfig.color
          }}>
            {interviewStyle === 'FAANG' && <Code2 size={13} />}
            {interviewStyle === 'MANGOS' && <Zap size={13} />}
            {interviewStyle === 'BIG_4' && <Building2 size={13} />}
            <span>{currentStyleConfig.name} Style</span>
          </div>

          {/* Question Counter Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            <span>Question #{currentQuestionOrder}</span>
          </div>
        </div>

        {/* Header Right: Total Countdown & End Interview Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          
          {/* Total Countdown Timer Component */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: isTotalWarning10Sec
              ? 'rgba(239, 68, 68, 0.2)'
              : isTotalWarning1Min
              ? 'rgba(245, 158, 11, 0.2)'
              : isTotalWarning5Min
              ? 'rgba(245, 158, 11, 0.1)'
              : 'rgba(255, 255, 255, 0.05)',
            border: isTotalWarning10Sec
              ? '1px solid rgba(239, 68, 68, 0.6)'
              : isTotalWarning1Min
              ? '1px solid rgba(245, 158, 11, 0.5)'
              : isTotalWarning5Min
              ? '1px solid rgba(245, 158, 11, 0.35)'
              : '1px solid var(--border-color)',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.9rem',
            transition: 'all 0.3s ease',
            boxShadow: isTotalWarning10Sec ? '0 0 15px rgba(239, 68, 68, 0.4)' : 'none'
          }}>
            <Clock size={16} color={isTotalWarning10Sec ? '#ef4444' : (isTotalWarning1Min || isTotalWarning5Min) ? '#f59e0b' : 'var(--accent-indigo)'} />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Total Remaining</span>
              <span style={{
                fontWeight: 700,
                fontFamily: 'monospace',
                fontSize: '1rem',
                color: isTotalWarning10Sec ? '#ef4444' : (isTotalWarning1Min || isTotalWarning5Min) ? '#f59e0b' : 'var(--text-primary)'
              }}>
                {formatCountdown(totalRemainingSeconds)}
              </span>
            </div>

            {/* Warning Badges */}
            {isTotalWarning10Sec && (
              <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', animation: 'spin 1s' }}>
                Ending Soon!
              </span>
            )}
            {isTotalWarning1Min && (
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                1m left
              </span>
            )}
            {isTotalWarning5Min && (
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                5m left
              </span>
            )}
          </div>

          <button onClick={handleEndInterview} disabled={isEnding} className="btn-danger">
            <Square size={16} />
            <span>{isEnding ? 'Finalizing Evaluation...' : 'End Interview'}</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', flex: 1 }}>
        
        {/* Left Column: Voice Orb & Transcript */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI Voice Avatar Orb Panel */}
          <div className="glass-panel" style={{ padding: '2.5rem 2rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            
            {/* Start Voice Session Overlay if not started */}
            {!sessionStarted ? (
              <div style={{ padding: '1rem 0' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem auto',
                  boxShadow: '0 8px 30px rgba(99, 102, 241, 0.5)'
                }}>
                  <Volume2 size={44} color="#ffffff" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  Ready to Start {currentStyleConfig.name} Voice Interview
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
                  Preset: <strong>{currentStyleConfig.name}</strong> ({currentStyleConfig.companies.join(', ')}). 
                  Total duration: <strong>{Math.floor(TOTAL_INTERVIEW_DURATION_SECONDS / 60)} minutes</strong> ({PER_QUESTION_DURATION_SECONDS} seconds per question).
                  Click below to authorize audio playback and start the countdown.
                </p>
                <button onClick={handleStartVoiceSession} className="btn-primary" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
                  <Play size={20} />
                  <span>Start Voice Session Now</span>
                </button>
              </div>
            ) : (
              <>
                {/* Per-Question Answer Countdown Pill */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  background: isQuestionWarning5Sec
                    ? 'rgba(239, 68, 68, 0.25)'
                    : isQuestionWarning15Sec
                    ? 'rgba(245, 158, 11, 0.2)'
                    : isQuestionTimerActive
                    ? 'rgba(99, 102, 241, 0.12)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: isQuestionWarning5Sec
                    ? '1.5px solid rgba(239, 68, 68, 0.7)'
                    : isQuestionWarning15Sec
                    ? '1px solid rgba(245, 158, 11, 0.6)'
                    : '1px solid var(--border-color)',
                  marginBottom: '1.25rem',
                  transition: 'all 0.3s ease',
                  boxShadow: isQuestionWarning5Sec ? '0 0 20px rgba(239, 68, 68, 0.4)' : 'none'
                }}>
                  <Timer size={16} color={isQuestionWarning5Sec ? '#ef4444' : isQuestionWarning15Sec ? '#f59e0b' : 'var(--accent-indigo)'} />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {isQuestionTimerActive ? 'Question Answer Time:' : 'Interviewer Speaking:'}
                  </span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: isQuestionWarning5Sec ? '#ef4444' : isQuestionWarning15Sec ? '#f59e0b' : 'var(--accent-cyan)'
                  }}>
                    {isQuestionTimerActive ? formatCountdown(questionRemainingSeconds) : 'Timer Paused'}
                  </span>
                  {isQuestionWarning5Sec && (
                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase' }}>
                      Final 5s!
                    </span>
                  )}
                  {isQuestionWarning15Sec && (
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                      15s remaining
                    </span>
                  )}
                </div>

                {/* Animated Glowing Voice Orb */}
                <div 
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: '50%',
                    background: voiceState === 'AI_SPEAKING' ? 'var(--gradient-primary)' : voiceState === 'LISTENING' ? 'linear-gradient(135deg, #22c55e, #10b981)' : 'var(--bg-surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem auto',
                    border: `3px solid ${currentStyleConfig.color}60`,
                    transition: 'all 0.4s ease',
                    boxShadow: voiceState === 'AI_SPEAKING' ? `0 0 35px ${currentStyleConfig.color}60` : voiceState === 'LISTENING' ? '0 0 35px rgba(34, 197, 94, 0.5)' : 'none'
                  }} 
                  className={voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING' ? 'voice-pulse-active' : ''}
                >
                  {voiceState === 'LISTENING' ? (
                    <Mic size={52} color="#ffffff" />
                  ) : (
                    <Bot size={52} color={voiceState === 'AI_SPEAKING' ? '#ffffff' : currentStyleConfig.color} />
                  )}
                </div>

                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                  Interv<span className="gradient-text">AI</span> Voice Interviewer
                </h3>

                {/* Voice State Badge */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '25px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${stateBanner.color}`,
                  color: stateBanner.color,
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  marginBottom: '1rem'
                }}>
                  {stateBanner.icon}
                  <span>{stateBanner.label}</span>
                </div>

                {/* Frequency Spectrum Waveform */}
                {(voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING') && (
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', height: '36px' }}>
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                    <div className="wave-bar" />
                  </div>
                )}

                {/* Candidate Interim Live Speech View */}
                {voiceState === 'LISTENING' && interimSpeechText && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    color: '#22c55e',
                    fontSize: '0.95rem',
                    fontStyle: 'italic',
                    maxWidth: '600px',
                    margin: '1rem auto 0 auto'
                  }}>
                    "{interimSpeechText}"
                  </div>
                )}

                {/* Action controls: Interrupt / Re-listen */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '1.25rem' }}>
                  {voiceState === 'AI_SPEAKING' && (
                    <button onClick={handleInterruptAI} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                      <VolumeX size={16} />
                      <span>Interrupt AI & Answer</span>
                    </button>
                  )}
                  {voiceState !== 'AI_SPEAKING' && voiceState !== 'LISTENING' && (
                    <button onClick={handleManualStartListening} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
                      <Mic size={16} color="#22c55e" />
                      <span>Tap to Speak</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Live Transcript Stream Panel */}
          <div className="glass-panel" style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Verified Interview Transcript</span>
              <span style={{ color: currentStyleConfig.color, fontSize: '0.75rem', textTransform: 'none', fontWeight: 700 }}>
                {currentStyleConfig.name} Probing
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '6px' }}>
              {transcript.map((turn, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  gap: '12px',
                  alignSelf: turn.speaker === 'AI' ? 'flex-start' : 'flex-end',
                  maxWidth: '85%'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: turn.speaker === 'AI' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {turn.speaker === 'AI' ? <Bot size={18} color="var(--accent-indigo)" /> : <User size={18} color="var(--accent-pink)" />}
                  </div>

                  <div style={{
                    background: turn.speaker === 'AI' ? 'var(--bg-surface-elevated)' : 'rgba(236, 72, 153, 0.08)',
                    border: '1px solid var(--border-color)',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    fontSize: '0.925rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.75rem', color: turn.speaker === 'AI' ? 'var(--accent-indigo)' : 'var(--accent-pink)' }}>
                        {turn.speaker === 'AI' ? `IntervAI (${currentStyleConfig.name})` : candidateName}
                      </span>
                      {turn.status && turn.status !== 'answered' && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: turn.status === 'timed_out' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: turn.status === 'timed_out' ? '#f59e0b' : '#ef4444'
                        }}>
                          {turn.status === 'timed_out' ? 'Timed Out' : 'Unanswered'}
                        </span>
                      )}
                    </div>
                    <div>{turn.text}</div>
                    {turn.groundingSource && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                        Source: {turn.groundingSource}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Accessibility Manual Text Input Fallback (Accordion) */}
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setShowAccessibilityText(!showAccessibilityText)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {showAccessibilityText ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>Text Fallback (For debugging / accessibility)</span>
              </button>

              {showAccessibilityText && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                  <input
                    type="text"
                    placeholder="Type answer manually if microphone unavailable..."
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualText.trim()) {
                        handleCandidateFinalAnswer(manualText, 'answered');
                        setManualText('');
                      }
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (manualText.trim()) {
                        handleCandidateFinalAnswer(manualText, 'answered');
                        setManualText('');
                      }
                    }}
                    className="btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <Send size={14} />
                    <span>Submit</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Sidebar: Context & Voice Status */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            Interview Control & Context
          </h4>

          {/* Timing Rules Card */}
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.07)',
            border: '1px solid rgba(99, 102, 241, 0.25)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Pacing & Timing Limits
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>• Total Session: <strong>{TOTAL_INTERVIEW_DURATION_SECONDS / 60} mins</strong></div>
              <div>• Per-Question Limit: <strong>{PER_QUESTION_DURATION_SECONDS} secs</strong></div>
              <div>• Warning Alerts: <strong>5m, 1m & 10s</strong> total; <strong>15s & 5s</strong> per question</div>
            </div>
          </div>

          {/* Active Style Details Card */}
          <div style={{
            padding: '12px',
            borderRadius: '10px',
            background: `${currentStyleConfig.color}10`,
            border: `1px solid ${currentStyleConfig.color}35`
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>
              Selected Style Preset
            </div>
            <div style={{ fontWeight: 800, color: currentStyleConfig.color, fontSize: '1rem' }}>
              {currentStyleConfig.name} • {currentStyleConfig.badge}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {currentStyleConfig.companies.join(', ')}
            </div>
          </div>

          {/* Microphone Status Card */}
          <div style={{ padding: '12px', borderRadius: '10px', background: micGranted ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)', border: `1px solid ${micGranted ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700, fontSize: '0.9rem', color: micGranted ? '#22c55e' : '#f87171' }}>
              {micGranted ? <Mic size={18} /> : <MicOff size={18} />}
              <span>{micGranted ? 'MICROPHONE ACTIVE' : 'MICROPHONE DISABLED'}</span>
            </div>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {micGranted ? 'Speak directly. Silence turn-detection finalizes your answer.' : 'Click Start Voice Session to activate microphone.'}
            </p>
          </div>

          {/* Grounded Projects List */}
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Grounded Resume Context
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.map((proj, i) => (
                <div key={i} style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{proj.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Source: {proj.contextSource}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', padding: '10px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <Sparkles size={14} color="var(--accent-indigo)" style={{ display: 'inline', marginRight: '6px' }} />
            <span>AI speaks every question aloud. Countdown begins only when interviewer speech completes.</span>
          </div>
        </div>

      </div>

      <style jsx global>{`
        .spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
