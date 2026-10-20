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
  Play,
  ChevronDown,
  ChevronUp,
  Code2,
  Zap,
  Building2,
  Timer,
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
  AnswerStatus,
} from '@/lib/interviewer/interviewConfig';
import PageShell from '@/components/layout/PageShell';

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
  const [activeGroundingSource, setActiveGroundingSource] = useState<string>('Initializing context...');
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
  const activeGroundingSourceRef = useRef<string>('Initializing context...');
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
      onStateChange: (state: VoiceState) => {
        if (!isMounted) return;
        setVoiceState(state);

        if (state === 'LISTENING') {
          startQuestionTimer();
        } else if (state === 'AI_SPEAKING' || state === 'PROCESSING_ANSWER') {
          stopQuestionTimer();
        }
      },
      onInterimTranscript: (text: string) => {
        if (!isMounted) return;
        setInterimSpeechText(text);
      },
      onFinalTranscript: (finalTranscript: string) => {
        if (!isMounted) return;
        handleCandidateFinalAnswer(finalTranscript, 'answered');
      },
      onError: (err: string) => {
        if (!isMounted) return;
        console.warn('Speech engine warning:', err);
        setErrorMessage(err);
      },
    });

    speechEngineRef.current = engine;

    async function loadInterviewSession() {
      try {
        const res = await fetch(`/api/interview/session?interviewId=${interviewId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load interview context.');
        }

        if (isMounted) {
          const loadedProjects = data.projects || [];
          if (!loadedProjects || loadedProjects.length === 0) {
            setErrorMessage('Candidate project context could not be loaded. Please re-upload your resume.');
            return;
          }

          const hasOnlyPlaceholders = loadedProjects.every(
            (p: any) => !p.name || p.name.toLowerCase().includes('primary technical project') || p.name.toLowerCase().includes('unknown project')
          );
          if (hasOnlyPlaceholders) {
            setErrorMessage('Unable to extract authentic projects from resume. Please re-upload your resume with distinct project sections.');
            return;
          }

          setCandidateName(data.candidateName || 'Candidate');
          setProjects(loadedProjects);
          if (data.interviewStyle) {
            setInterviewStyle(data.interviewStyle as InterviewStyleId);
          }

          const openingQ = data.openingQuestion;
          const openingSrc = data.openingSource || (loadedProjects[0] ? `project:${loadedProjects[0].name}:overview` : 'resume:context');

          if (!openingQ || openingQ.toLowerCase().includes('primary project')) {
            const p1 = loadedProjects[0];
            const p1Name = p1?.name || 'your project';
            const techMention = (p1?.technologies && p1.technologies.length > 0) ? ` using ${p1.technologies.slice(0, 2).join(' and ')}` : '';
            const fallbackGroundedQ = `Hello ${data.candidateName || 'Candidate'}. To begin our technical discussion in ${p1Name}${techMention}, walk me through the core architecture and key engineering decisions you made.`;
            setOpeningQuestionText(fallbackGroundedQ);
            lastQuestionTextRef.current = fallbackGroundedQ;
            setActiveGroundingSource(`project:${p1Name}:architecture`);
            activeGroundingSourceRef.current = `project:${p1Name}:architecture`;
          } else {
            setOpeningQuestionText(openingQ);
            lastQuestionTextRef.current = openingQ;
            setActiveGroundingSource(openingSrc);
            activeGroundingSourceRef.current = openingSrc;
          }
        }
      } catch (e: any) {
        if (isMounted) {
          setErrorMessage(e.message || 'Error initializing interview session.');
        }
      }
    }

    loadInterviewSession();

    return () => {
      isMounted = false;
      clearAllTimers();
      if (speechEngineRef.current) {
        speechEngineRef.current.destroy();
      }
    };
  }, [interviewId]);

  // Total countdown timer
  const startTotalTimer = () => {
    if (totalTimerIntervalRef.current) return;

    totalDeadlineRef.current = Date.now() + TOTAL_INTERVIEW_DURATION_SECONDS * 1000;
    setTotalRemainingSeconds(TOTAL_INTERVIEW_DURATION_SECONDS);

    totalTimerIntervalRef.current = setInterval(() => {
      if (!totalDeadlineRef.current || isEndingRef.current) return;
      const remainingMs = totalDeadlineRef.current - Date.now();
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
      setTotalRemainingSeconds(remainingSec);

      if (remainingSec <= 0) {
        clearAllTimers();
        handleTotalTimeExpired();
      }
    }, 1000);
  };

  const handleTotalTimeExpired = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsEnding(true);

    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
    }

    const currentAnswer = interimSpeechText || manualText;
    if (currentAnswer && currentAnswer.trim()) {
      try {
        await submitCandidateAnswer(currentAnswer, 'timed_out');
      } catch (e) {
        console.error('Error submitting in-progress answer on timeout:', e);
      }
    }

    await handleEndInterview();
  };

  const handleQuestionTimeout = () => {
    if (isEndingRef.current || isSubmittingRef.current) return;
    if (speechEngineRef.current) {
      speechEngineRef.current.stopListening();
    }

    const finalAnswer = interimSpeechText.trim() || manualText.trim();
    const status: AnswerStatus = finalAnswer.length > 0 ? 'timed_out' : 'unanswered';
    handleCandidateFinalAnswer(finalAnswer || '(Candidate did not provide an answer within time limit)', status);
  };

  const handleStartVoiceSession = async () => {
    if (!speechEngineRef.current) return;
    if (errorMessage && (!projects || projects.length === 0)) return;

    let openingQ = openingQuestionText;
    if (!openingQ && projects.length > 0) {
      const p1 = projects[0];
      const p1Name = p1?.name || 'your project';
      const techMention = (p1?.technologies && p1.technologies.length > 0) ? ` using ${p1.technologies.slice(0, 2).join(' and ')}` : '';
      openingQ = `Hello ${candidateName}. To begin our technical discussion in ${p1Name}${techMention}, walk me through the core architecture and key engineering decisions you made.`;
      setOpeningQuestionText(openingQ);
      lastQuestionTextRef.current = openingQ;
    }

    if (!openingQ) {
      setErrorMessage('Interview question context is missing. Cannot start session without grounded questions.');
      return;
    }

    const currentSrc = (activeGroundingSourceRef.current && activeGroundingSourceRef.current !== 'Initializing context...')
      ? activeGroundingSourceRef.current
      : (projects[0] ? `project:${projects[0].name}:architecture` : 'resume:context');

    setActiveGroundingSource(currentSrc);
    activeGroundingSourceRef.current = currentSrc;

    setSessionStarted(true);
    setMicGranted(true);
    startTotalTimer();

    setTranscript((prev) => [
      ...prev,
      {
        order: 1,
        speaker: 'AI',
        text: openingQ,
        groundingSource: currentSrc,
      },
    ]);

    await speechEngineRef.current.speakAIQuestion(openingQ);
  };

  const handleCandidateFinalAnswer = async (answerText: string, status: AnswerStatus = 'answered') => {
    if (isSubmittingRef.current || isEndingRef.current) return;
    isSubmittingRef.current = true;
    stopQuestionTimer();
    setInterimSpeechText('');

    const trimmed = answerText.trim();
    const effectiveText = trimmed || '(No answer provided)';

    setTranscript((prev) => [
      ...prev,
      {
        order: currentQuestionOrderRef.current,
        speaker: 'Candidate',
        text: effectiveText,
        status,
      },
    ]);

    await submitCandidateAnswer(effectiveText, status);
    isSubmittingRef.current = false;
  };

  const submitCandidateAnswer = async (answerText: string, status: AnswerStatus) => {
    setVoiceState('PROCESSING_ANSWER');

    try {
      const currentProj = projects[0];
      const res = await fetch('/api/interview/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          order: currentQuestionOrderRef.current,
          question: lastQuestionTextRef.current,
          questionText: lastQuestionTextRef.current,
          answer: answerText,
          transcript: answerText,
          status,
          groundingSource: activeGroundingSourceRef.current,
          style: interviewStyle,
          projectId: currentProj?.id || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to process candidate answer.');
      }

      if (data.interviewFinished || isEndingRef.current) {
        await handleEndInterview();
        return;
      }

      const nextQ = data.nextQuestion || data.question;
      if (nextQ) {
        const nextOrder = data.nextOrder || (currentQuestionOrderRef.current + 1);
        setCurrentQuestionOrder(nextOrder);
        currentQuestionOrderRef.current = nextOrder;

        const nextSource = data.nextGroundingSource || data.groundingSource || activeGroundingSourceRef.current;
        setActiveGroundingSource(nextSource);
        activeGroundingSourceRef.current = nextSource;

        lastQuestionTextRef.current = nextQ;

        setTranscript((prev) => [
          ...prev,
          {
            order: nextOrder,
            speaker: 'AI',
            text: nextQ,
            groundingSource: nextSource,
          },
        ]);

        if (speechEngineRef.current && !isEndingRef.current) {
          await speechEngineRef.current.speakAIQuestion(nextQ);
        }
      }
    } catch (err: any) {
      console.error('Answer processing error:', err);
      setErrorMessage(err.message || 'Error processing response. Resuming voice session.');
      setTimeout(() => {
        if (speechEngineRef.current && !isEndingRef.current) {
          speechEngineRef.current.startListening();
        }
      }, 700);
    }
  };

  const handleInterruptAI = () => {
    if (speechEngineRef.current) {
      speechEngineRef.current.stopSpeaking();
      speechEngineRef.current.startListening();
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
        body: JSON.stringify({ interviewId }),
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
        return {
          label: `IntervAI is speaking (${currentStyleConfig.name} style)...`,
          color: '#00f0ff',
          icon: <Volume2 size={18} />,
        };
      case 'LISTENING':
        return {
          label: 'Listening to candidate... Speak your answer into microphone',
          color: '#22c55e',
          icon: <Mic size={18} />,
        };
      case 'PROCESSING_ANSWER':
        return {
          label: 'Analyzing answer against candidate context dossier...',
          color: '#00d9ff',
          icon: <RefreshCw size={18} className="spin-icon" />,
        };
      case 'GENERATING_NEXT_QUESTION':
        return {
          label: `Formulating ${currentStyleConfig.name} follow-up question...`,
          color: '#00d9ff',
          icon: <Sparkles size={18} />,
        };
      case 'INTERVIEW_ENDED':
        return {
          label: 'Interview concluding. Finalizing evaluation report...',
          color: '#00d9ff',
          icon: <RefreshCw size={18} className="spin-icon" />,
        };
      case 'ERROR':
        return {
          label: errorMessage || 'Microphone error',
          color: '#f87171',
          icon: <AlertCircle size={18} />,
        };
      default:
        return {
          label: `Ready to Start (${currentStyleConfig.name} Style)`,
          color: '#00d9ff',
          icon: <Play size={18} />,
        };
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
    <PageShell
      title="Live Voice Technical Interview"
      badge={
        <span className="fm-interview-header-badge">
          {interviewStyle === 'FAANG' && <Code2 size={13} />}
          {interviewStyle === 'MANGOS' && <Zap size={13} />}
          {interviewStyle === 'BIG_4' && <Building2 size={13} />}
          <span>{currentStyleConfig.name} Preset</span>
        </span>
      }
      rightAction={
        <div className="fm-header-actions">
          {/* Total Countdown Timer Component */}
          <div
            className={`fm-total-timer ${isTotalWarning10Sec ? 'is-warning-10s' : isTotalWarning1Min ? 'is-warning-1m' : isTotalWarning5Min ? 'is-warning-5m' : ''}`}
          >
            <Clock
              size={16}
              color={isTotalWarning10Sec ? '#ef4444' : isTotalWarning1Min || isTotalWarning5Min ? '#f59e0b' : '#00d9ff'}
            />
            <div className="fm-timer-text">
              <span className="fm-timer-label">Total Time</span>
              <span className="fm-timer-digits">{formatCountdown(totalRemainingSeconds)}</span>
            </div>
            {isTotalWarning10Sec && <span className="fm-timer-badge danger">Ending Soon!</span>}
            {isTotalWarning1Min && <span className="fm-timer-badge warning">1m left</span>}
            {isTotalWarning5Min && <span className="fm-timer-badge warning">5m left</span>}
          </div>

          <button onClick={handleEndInterview} disabled={isEnding} className="btn-danger">
            <Square size={14} />
            <span>{isEnding ? 'Finalizing...' : 'End Interview'}</span>
          </button>
        </div>
      }
      maxWidth="1200px"
    >
      <div className="fm-interview-stage">
        {/* Sub-Header Candidate Bar */}
        <div className="fm-interview-subbar">
          <div className="fm-subbar-left">
            <span className="fm-status-dot" style={{ background: stateBanner.color, boxShadow: `0 0 10px ${stateBanner.color}` }} />
            <span className="fm-candidate-name">{candidateName}</span>
            <span className="fm-dot-sep">•</span>
            <span className="fm-q-pill">Question #{currentQuestionOrder}</span>
          </div>

          <div className="fm-subbar-right">
            <span className="fm-grounding-indicator">
              Grounding: <strong>{activeGroundingSource}</strong>
            </span>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="fm-interview-grid">
          {/* Left Column: Voice Orb & Transcript */}
          <div className="fm-interview-left">
            {/* AI Voice Avatar Orb Panel */}
            <div className="glass-panel fm-voice-panel">
              {!sessionStarted ? (
                <div className="fm-pre-session">
                  <div className="fm-pre-orb">
                    <Volume2 size={40} color="#ffffff" />
                  </div>
                  <h3 className="fm-pre-title">
                    Ready to Start {currentStyleConfig.name} Voice Interview
                  </h3>
                  <p className="fm-pre-desc">
                    Style: <strong>{currentStyleConfig.name}</strong> ({currentStyleConfig.companies.join(', ')}).
                    Total duration: <strong>{Math.floor(TOTAL_INTERVIEW_DURATION_SECONDS / 60)} minutes</strong> ({PER_QUESTION_DURATION_SECONDS}s per question).
                    Click below to authorize your microphone and launch the conversation.
                  </p>
                  {errorMessage && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {projects.length === 0 && errorMessage ? (
                    <button onClick={() => router.push('/')} className="btn-secondary fm-launch-btn">
                      <span>Return to Upload Resume</span>
                    </button>
                  ) : (
                    <button onClick={handleStartVoiceSession} className="btn-primary fm-launch-btn">
                      <Play size={18} />
                      <span>Start Voice Session Now</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="fm-active-session">
                  {/* Per-Question Answer Countdown Pill */}
                  <div
                    className={`fm-question-timer ${isQuestionWarning5Sec ? 'is-warn-5s' : isQuestionWarning15Sec ? 'is-warn-15s' : isQuestionTimerActive ? 'is-active' : ''}`}
                  >
                    <Timer
                      size={15}
                      color={isQuestionWarning5Sec ? '#ef4444' : isQuestionWarning15Sec ? '#f59e0b' : '#00d9ff'}
                    />
                    <span className="q-timer-label">
                      {isQuestionTimerActive ? 'Question Answer Time:' : 'Interviewer Speaking:'}
                    </span>
                    <span className="q-timer-val">
                      {isQuestionTimerActive ? formatCountdown(questionRemainingSeconds) : 'Timer Paused'}
                    </span>
                    {isQuestionWarning5Sec && <span className="q-warn-pill red">Final 5s!</span>}
                    {isQuestionWarning15Sec && <span className="q-warn-pill amber">15s remaining</span>}
                  </div>

                  {/* Animated Glowing Voice Orb */}
                  <div
                    className={`fm-voice-orb ${voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING' ? 'voice-pulse-active' : ''} ${voiceState === 'LISTENING' ? 'is-listening' : 'is-ai'}`}
                  >
                    {voiceState === 'LISTENING' ? (
                      <Mic size={48} color="#ffffff" />
                    ) : (
                      <Bot size={48} color="#ffffff" />
                    )}
                  </div>

                  <h3 className="fm-orb-title">
                    Interv<span className="gradient-text">AI</span> Autonomous Interviewer
                  </h3>

                  {/* Voice State Badge */}
                  <div className="fm-voice-state-badge" style={{ borderColor: stateBanner.color, color: stateBanner.color }}>
                    {stateBanner.icon}
                    <span>{stateBanner.label}</span>
                  </div>

                  {/* Frequency Spectrum Waveform */}
                  {(voiceState === 'AI_SPEAKING' || voiceState === 'LISTENING') && (
                    <div className="fm-spectrum">
                      <div className="wave-bar" />
                      <div className="wave-bar" />
                      <div className="wave-bar" />
                      <div className="wave-bar" />
                      <div className="wave-bar" />
                    </div>
                  )}

                  {/* Candidate Interim Live Speech View */}
                  {voiceState === 'LISTENING' && interimSpeechText && (
                    <div className="fm-interim-box">
                      &ldquo;{interimSpeechText}&rdquo;
                    </div>
                  )}

                  {/* Action controls: Interrupt / Re-listen */}
                  <div className="fm-orb-controls">
                    {voiceState === 'AI_SPEAKING' && (
                      <button onClick={handleInterruptAI} className="btn-secondary fm-orb-btn">
                        <VolumeX size={15} />
                        <span>Interrupt AI & Answer</span>
                      </button>
                    )}
                    {voiceState !== 'AI_SPEAKING' && voiceState !== 'LISTENING' && (
                      <button onClick={handleManualStartListening} className="btn-secondary fm-orb-btn">
                        <Mic size={15} color="#22c55e" />
                        <span>Tap to Speak</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Live Transcript Stream Panel */}
            <div className="glass-panel fm-transcript-panel">
              <div className="fm-transcript-header">
                <span>Verified Interview Transcript</span>
                <span className="fm-probing-tag">{currentStyleConfig.name} Probing</span>
              </div>

              <div className="fm-transcript-stream">
                {transcript.length === 0 ? (
                  <div className="fm-transcript-empty">
                    Transcript turns will appear here in real-time as the voice conversation progresses.
                  </div>
                ) : (
                  transcript.map((turn, idx) => (
                    <div
                      key={idx}
                      className={`fm-turn-row ${turn.speaker === 'AI' ? 'is-ai-turn' : 'is-user-turn'}`}
                    >
                      <div className="fm-turn-avatar">
                        {turn.speaker === 'AI' ? <Bot size={16} /> : <User size={16} />}
                      </div>

                      <div className="fm-turn-bubble">
                        <div className="fm-turn-head">
                          <span className="fm-turn-author">
                            {turn.speaker === 'AI' ? `IntervAI (${currentStyleConfig.name})` : candidateName}
                          </span>
                          {turn.status && turn.status !== 'answered' && (
                            <span
                              className={`fm-turn-status ${turn.status === 'timed_out' ? 'is-timed-out' : 'is-unanswered'}`}
                            >
                              {turn.status === 'timed_out' ? 'Timed Out' : 'Unanswered'}
                            </span>
                          )}
                        </div>
                        <div className="fm-turn-body">{turn.text}</div>
                        {turn.groundingSource && (
                          <div className="fm-turn-source">Source: {turn.groundingSource}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Accessibility Manual Text Input Fallback (Accordion) */}
              <div className="fm-accessibility-box">
                <button
                  type="button"
                  onClick={() => setShowAccessibilityText(!showAccessibilityText)}
                  className="fm-accessibility-toggle"
                >
                  {showAccessibilityText ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>Text Fallback (For accessibility & noisy environments)</span>
                </button>

                {showAccessibilityText && (
                  <div className="fm-accessibility-form">
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
                      className="fm-manual-input"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (manualText.trim()) {
                          handleCandidateFinalAnswer(manualText, 'answered');
                          setManualText('');
                        }
                      }}
                      className="btn-secondary fm-manual-submit"
                    >
                      <Send size={14} />
                      <span>Submit</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Context & Controls Sidebar */}
          <div className="glass-panel fm-sidebar-panel">
            <h4 className="fm-sidebar-title">Interview Control & Context</h4>

            {/* Timing Rules Card */}
            <div className="fm-timing-rules-card">
              <div className="timing-rules-head">Pacing & Timing Limits</div>
              <div className="timing-rules-list">
                <div>• Total Session: <strong>{TOTAL_INTERVIEW_DURATION_SECONDS / 60} mins</strong></div>
                <div>• Per-Question Limit: <strong>{PER_QUESTION_DURATION_SECONDS} secs</strong></div>
                <div>• Warning Alerts: <strong>5m, 1m & 10s</strong> total; <strong>15s & 5s</strong> per question</div>
              </div>
            </div>

            {/* Active Style Preset Card */}
            <div className="fm-active-style-card">
              <div className="active-style-label">Selected Style Preset</div>
              <div className="active-style-name">
                {currentStyleConfig.name} • {currentStyleConfig.badge}
              </div>
              <div className="active-style-comps">{currentStyleConfig.companies.join(', ')}</div>
            </div>

            {/* Microphone Status Card */}
            <div className={`fm-mic-status-card ${micGranted ? 'is-granted' : 'is-denied'}`}>
              <div className="mic-status-row">
                {micGranted ? <Mic size={16} /> : <MicOff size={16} />}
                <span>{micGranted ? 'MICROPHONE ACTIVE' : 'MICROPHONE DISABLED'}</span>
              </div>
              <p className="mic-status-desc">
                {micGranted
                  ? 'Speak directly. Automatic silence detection finalizes your answer.'
                  : 'Start voice session to authorize microphone input.'}
              </p>
            </div>

            {/* Grounded Resume Projects List */}
            <div className="fm-projects-box">
              <div className="projects-box-head">Grounded Resume Context</div>
              <div className="projects-box-list">
                {projects.length === 0 ? (
                  <div className="projects-empty" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.6)' }}>
                    <AlertCircle size={14} color="#f59e0b" />
                    <span>No extracted projects found.</span>
                  </div>
                ) : (
                  projects.map((proj, i) => (
                    <div key={i} className="proj-item-card">
                      <div className="proj-item-name">{proj.name}</div>
                      <div className="proj-item-src">Source: {proj.contextSource || 'resume_only'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* AI Prompter Tip */}
            <div className="fm-ai-prompter-tip">
              <Sparkles size={14} color="#00d9ff" />
              <span>Questions are generated and grounded exclusively in your own resume claims and code.</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .fm-interview-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 9999px;
          background: rgba(0, 217, 255, 0.15);
          border: 1px solid rgba(0, 217, 255, 0.35);
          color: #00d9ff;
          font-size: 0.75rem;
          font-weight: 700;
        }

        .fm-header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        /* Total Countdown Timer Pill */
        .fm-total-timer {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.4rem 0.9rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1.5px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          transition: all 0.3s ease;
        }

        .fm-total-timer.is-warning-5m {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.45);
        }

        .fm-total-timer.is-warning-1m {
          background: rgba(245, 158, 11, 0.25);
          border-color: rgba(245, 158, 11, 0.7);
          box-shadow: 0 0 14px rgba(245, 158, 11, 0.35);
        }

        .fm-total-timer.is-warning-10s {
          background: rgba(239, 68, 68, 0.25);
          border-color: #ef4444;
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.45);
          animation: pulse-ring 1s infinite;
        }

        .fm-timer-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .fm-timer-label {
          font-size: 0.625rem;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.65);
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        .fm-timer-digits {
          font-family: monospace;
          font-weight: 800;
          font-size: 0.9375rem;
          letter-spacing: 0.04em;
        }

        .fm-timer-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .fm-timer-badge.warning {
          background: #f59e0b;
          color: #000000;
        }
        .fm-timer-badge.danger {
          background: #ef4444;
          color: #ffffff;
        }

        /* Subbar */
        .fm-interview-subbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .fm-subbar-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .fm-status-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .fm-candidate-name {
          font-weight: 700;
          color: #ffffff;
        }

        .fm-dot-sep {
          color: rgba(255, 255, 255, 0.35);
        }

        .fm-q-pill {
          padding: 2px 8px;
          border-radius: 8px;
          background: rgba(0, 217, 255, 0.15);
          color: #00d9ff;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .fm-grounding-indicator {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.75);
        }

        /* 2-Column Grid */
        .fm-interview-grid {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 1.5rem;
        }

        @media (max-width: 960px) {
          .fm-interview-grid {
            grid-template-columns: 1fr;
          }
        }

        .fm-interview-left {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Voice Panel */
        .fm-voice-panel {
          padding: 2.25rem 2rem;
          text-align: center;
        }

        .fm-pre-session {
          padding: 1rem 0;
        }

        .fm-pre-orb {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #0753bf 0%, #00d9ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem auto;
          box-shadow: 0 0 30px rgba(0, 217, 255, 0.4);
        }

        .fm-pre-title {
          font-size: 1.35rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .fm-pre-desc {
          font-size: 0.875rem;
          line-height: 1.55;
          color: var(--text-secondary);
          max-width: 520px;
          margin: 0 auto 1.5rem auto;
        }

        .fm-launch-btn {
          padding: 0.85rem 2rem;
          font-size: 1rem;
        }

        /* Active Voice Orb */
        .fm-question-timer {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 1rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.2);
          margin-bottom: 1.25rem;
          font-size: 0.8125rem;
        }

        .fm-question-timer.is-active {
          background: rgba(0, 217, 255, 0.12);
          border-color: rgba(0, 217, 255, 0.45);
        }

        .fm-question-timer.is-warn-15s {
          background: rgba(245, 158, 11, 0.18);
          border-color: rgba(245, 158, 11, 0.6);
        }

        .fm-question-timer.is-warn-5s {
          background: rgba(239, 68, 68, 0.22);
          border-color: #ef4444;
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.35);
        }

        .q-timer-label {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
        }

        .q-timer-val {
          font-family: monospace;
          font-weight: 800;
          font-size: 0.9375rem;
          color: #00d9ff;
        }

        .q-warn-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 6px;
          text-transform: uppercase;
        }
        .q-warn-pill.amber {
          background: #f59e0b;
          color: #000;
        }
        .q-warn-pill.red {
          background: #ef4444;
          color: #fff;
        }

        .fm-voice-orb {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem auto;
          transition: all 0.3s ease;
        }

        .fm-voice-orb.is-ai {
          background: linear-gradient(135deg, #0753bf 0%, #00d9ff 100%);
          border: 3px solid rgba(0, 217, 255, 0.6);
          box-shadow: 0 0 30px rgba(0, 217, 255, 0.45);
        }

        .fm-voice-orb.is-listening {
          background: linear-gradient(135deg, #15803d 0%, #22c55e 100%);
          border: 3px solid rgba(34, 197, 94, 0.7);
          box-shadow: 0 0 35px rgba(34, 197, 94, 0.55);
        }

        .fm-orb-title {
          font-size: 1.35rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }

        .fm-voice-state-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 1.15rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .fm-spectrum {
          display: flex;
          gap: 6px;
          justify-content: center;
          align-items: center;
          height: 36px;
          margin-bottom: 0.75rem;
        }

        .fm-interim-box {
          margin: 0.75rem auto;
          padding: 0.75rem 1.25rem;
          border-radius: 10px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.35);
          color: #4ade80;
          font-size: 0.9375rem;
          font-style: italic;
          max-width: 580px;
        }

        .fm-orb-controls {
          display: flex;
          gap: 0.75rem;
          justify-content: center;
          margin-top: 1rem;
        }

        .fm-orb-btn {
          font-size: 0.8125rem;
          padding: 0.5rem 1rem;
        }

        /* Transcript Panel */
        .fm-transcript-panel {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          max-height: 420px;
        }

        .fm-transcript-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8125rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.65);
          margin-bottom: 1rem;
        }

        .fm-probing-tag {
          color: #00d9ff;
          text-transform: none;
          font-weight: 700;
        }

        .fm-transcript-stream {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-right: 0.5rem;
        }

        .fm-transcript-empty {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.875rem;
          text-align: center;
          padding: 2rem 1rem;
          font-style: italic;
        }

        .fm-turn-row {
          display: flex;
          gap: 0.75rem;
          max-width: 88%;
        }

        .fm-turn-row.is-ai-turn {
          align-self: flex-start;
        }

        .fm-turn-row.is-user-turn {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .fm-turn-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 217, 255, 0.18);
          color: #00d9ff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .is-user-turn .fm-turn-avatar {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .fm-turn-bubble {
          padding: 0.85rem 1.15rem;
          border-radius: 14px;
          font-size: 0.9375rem;
          line-height: 1.5;
        }

        .is-ai-turn .fm-turn-bubble {
          background: rgba(7, 83, 191, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .is-user-turn .fm-turn-bubble {
          background: rgba(0, 105, 233, 0.45);
          border: 1px solid rgba(0, 217, 255, 0.4);
          color: #ffffff;
        }

        .fm-turn-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }

        .fm-turn-author {
          font-size: 0.75rem;
          font-weight: 700;
          color: #00d9ff;
        }

        .is-user-turn .fm-turn-author {
          color: rgba(255, 255, 255, 0.9);
        }

        .fm-turn-status {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 6px;
        }
        .fm-turn-status.is-timed-out {
          background: rgba(245, 158, 11, 0.2);
          color: #f59e0b;
        }
        .fm-turn-status.is-unanswered {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .fm-turn-body {
          word-break: break-word;
        }

        .fm-turn-source {
          font-size: 0.6875rem;
          color: rgba(255, 255, 255, 0.55);
          margin-top: 0.35rem;
          font-style: italic;
        }

        .fm-accessibility-box {
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .fm-accessibility-toggle {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.65);
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          outline: none;
        }
        .fm-accessibility-toggle:hover {
          color: #ffffff;
        }

        .fm-accessibility-form {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }

        .fm-manual-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          color: #ffffff;
          font-size: 0.8125rem;
          outline: none;
        }
        .fm-manual-input:focus {
          border-color: #00d9ff;
        }

        .fm-manual-submit {
          padding: 0.5rem 0.85rem;
          font-size: 0.8125rem;
        }

        /* Sidebar Panel */
        .fm-sidebar-panel {
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .fm-sidebar-title {
          font-size: 1rem;
          font-weight: 700;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          padding-bottom: 0.75rem;
        }

        .fm-timing-rules-card {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          background: rgba(0, 217, 255, 0.08);
          border: 1px solid rgba(0, 217, 255, 0.25);
        }
        .timing-rules-head {
          font-size: 0.75rem;
          font-weight: 700;
          color: #00d9ff;
          text-transform: uppercase;
          margin-bottom: 0.35rem;
        }
        .timing-rules-list {
          font-size: 0.8125rem;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .fm-active-style-card {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .active-style-label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 0.2rem;
        }
        .active-style-name {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #00d9ff;
        }
        .active-style-comps {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.75);
          margin-top: 0.2rem;
        }

        .fm-mic-status-card {
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1px solid;
        }
        .fm-mic-status-card.is-granted {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(34, 197, 94, 0.3);
        }
        .fm-mic-status-card.is-denied {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
        }
        .mic-status-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 0.8125rem;
        }
        .is-granted .mic-status-row {
          color: #4ade80;
        }
        .is-denied .mic-status-row {
          color: #f87171;
        }
        .mic-status-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.3rem;
          line-height: 1.4;
        }

        .fm-projects-box {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .projects-box-head {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.6);
        }
        .projects-box-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .projects-empty {
          font-size: 0.8125rem;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
        }
        .proj-item-card {
          padding: 0.6rem 0.85rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .proj-item-name {
          font-weight: 700;
          font-size: 0.8125rem;
          color: #00d9ff;
        }
        .proj-item-src {
          font-size: 0.6875rem;
          color: rgba(255, 255, 255, 0.55);
          margin-top: 0.1rem;
        }

        .fm-ai-prompter-tip {
          margin-top: auto;
          padding: 0.75rem 0.85rem;
          border-radius: 10px;
          background: rgba(0, 217, 255, 0.08);
          border: 1px solid rgba(0, 217, 255, 0.2);
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.45;
        }
      `}</style>
    </PageShell>
  );
}
