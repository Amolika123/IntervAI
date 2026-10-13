'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  UploadCloud, 
  FileText, 
  Cpu, 
  GitBranch, 
  Mic, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  AudioWaveform, 
  Layers, 
  CheckCircle2, 
  Terminal, 
  Code2, 
  Play, 
  ChevronRight, 
  X, 
  AlertTriangle,
  GitPullRequest,
  Database,
  Server,
  Zap
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Background video controller state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOpacity, setVideoOpacity] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Video looping and fade controller with requestAnimationFrame
  useEffect(() => {
    // Check user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setIsReducedMotion(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let animFrameId: number;
    let restartTimeoutId: NodeJS.Timeout;
    let isFadingOut = false;
    let isRestarting = false;

    // Smooth 0.5s fade-in using requestAnimationFrame
    const fadeIn = () => {
      let start: number | null = null;
      const duration = 500; // 0.5s
      const animateFadeIn = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        setVideoOpacity(progress);
        if (progress < 1) {
          animFrameId = requestAnimationFrame(animateFadeIn);
        }
      };
      animFrameId = requestAnimationFrame(animateFadeIn);
    };

    // Smooth 0.5s fade-out near loop end, wait 100ms, and restart
    const fadeOutAndRestart = () => {
      if (isFadingOut) return;
      isFadingOut = true;
      let start: number | null = null;
      const duration = 500; // 0.5s
      const initialOpacity = 1;

      const animateFadeOut = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        setVideoOpacity(initialOpacity * (1 - progress));

        if (progress < 1) {
          animFrameId = requestAnimationFrame(animateFadeOut);
        } else {
          setVideoOpacity(0);
          isRestarting = true;
          // When video ends, reset opacity, wait 100ms, restart playback, and repeat
          restartTimeoutId = setTimeout(() => {
            if (!video) return;
            video.currentTime = 0;
            video.play()
              .then(() => {
                isFadingOut = false;
                isRestarting = false;
                fadeIn();
              })
              .catch((err) => {
                console.warn('Autoplay loop error:', err);
                setVideoError(true);
              });
          }, 100);
        }
      };
      animFrameId = requestAnimationFrame(animateFadeOut);
    };

    const handleTimeUpdate = () => {
      if (!video || isFadingOut || isRestarting) return;
      const timeLeft = video.duration - video.currentTime;
      // Start fade-out approximately 0.5s before end of playback
      if (video.duration > 1 && timeLeft <= 0.55) {
        fadeOutAndRestart();
      }
    };

    const handleLoadedData = () => {
      video.play()
        .then(() => {
          fadeIn();
        })
        .catch((err) => {
          console.warn('Autoplay prevented or video load notice:', err);
        });
    };

    const handleError = () => {
      setVideoError(true);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);

    if (video.readyState >= 3) {
      handleLoadedData();
    }

    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(restartTimeoutId);
      if (video) {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      }
    };
  }, []);

  // Upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf')) {
        setErrorMessage('Please select a valid PDF file.');
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

  // Capabilities list for marquee
  const capabilities = [
    { label: 'Resume-Grounded Questions', icon: <FileText size={16} color="#6366f1" /> },
    { label: 'GitHub Project Understanding', icon: <GitBranch size={16} color="#a855f7" /> },
    { label: 'Real-Time Voice Interview', icon: <Mic size={16} color="#22d3ee" /> },
    { label: 'Adaptive Follow-Ups', icon: <Sparkles size={16} color="#ec4899" /> },
    { label: 'FAANG Interview Style', icon: <Cpu size={16} color="#06b6d4" /> },
    { label: 'MANGOS Interview Style', icon: <Zap size={16} color="#8b5cf6" /> },
    { label: 'Big 4 Interview Style', icon: <Database size={16} color="#10b981" /> },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'hsl(var(--bg-hsl))', color: 'hsl(var(--fg-hsl))', position: 'relative', overflowX: 'hidden' }}>
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef}
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* ================================================== */}
      {/* 1. HERO SECTION WITH FULL-SCREEN BACKGROUND VIDEO */}
      {/* ================================================== */}
      <section style={{ 
        position: 'relative', 
        minHeight: '100svh', 
        width: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden'
      }}>
        
        {/* Full-Screen Looping Background Video */}
        {!isReducedMotion && !videoError && (
          <video
            ref={videoRef}
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_065045_c44942da-53c6-4804-b734-f9e07fc22e08.mp4"
            autoPlay
            muted
            playsInline
            preload="auto"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none',
              zIndex: 0,
              opacity: videoOpacity,
              transition: 'opacity 0.1s linear',
            }}
          />
        )}

        {/* Fallback ambient glow if video fails or reduced-motion is requested */}
        {(videoError || isReducedMotion) && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.08) 40%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}

        {/* ================================================== */}
        {/* 2. TRANSPARENT NAVIGATION BAR & GRADIENT DIVIDER   */}
        {/* ================================================== */}
        <header style={{ 
          position: 'relative', 
          zIndex: 20, 
          width: '100%', 
          padding: '1.5rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            width: '100%',
            maxWidth: '1360px',
            margin: '0 auto'
          }}>
            {/* Left: IntervAI Wordmark with minimalist voice-wave icon */}
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(168, 85, 247, 0.25) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)'
              }}>
                <AudioWaveform size={20} color="#22d3ee" />
              </div>
              <span style={{ 
                fontFamily: 'var(--font-headline)', 
                fontSize: '1.45rem', 
                fontWeight: 800, 
                letterSpacing: '-0.03em',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                Interv<span style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #a855f7, #22d3ee)', 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent' 
                }}>AI</span>
              </span>
            </a>

            {/* Center Navigation Links (Scroll targets) */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }} className="nav-center-links">
              <a href="#how-it-works" style={{ 
                color: 'hsl(var(--fg-secondary-hsl))', 
                textDecoration: 'none', 
                fontSize: '0.925rem', 
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-hsl))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-secondary-hsl))')}
              >
                How It Works
              </a>
              <a href="#interview-styles" style={{ 
                color: 'hsl(var(--fg-secondary-hsl))', 
                textDecoration: 'none', 
                fontSize: '0.925rem', 
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-hsl))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-secondary-hsl))')}
              >
                Interview Styles
              </a>
              <a href="#features" style={{ 
                color: 'hsl(var(--fg-secondary-hsl))', 
                textDecoration: 'none', 
                fontSize: '0.925rem', 
                fontWeight: 500,
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-hsl))')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'hsl(var(--fg-secondary-hsl))')}
              >
                Features
              </a>
            </nav>

            {/* Right: Rounded Liquid-Glass "Upload Resume" Button */}
            <button 
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                } else {
                  setIsUploadModalOpen(true);
                }
              }}
              className="liquid-glass"
              style={{
                borderRadius: '9999px',
                padding: '9px 20px',
                color: 'hsl(var(--fg-hsl))',
                fontSize: '0.875rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer'
              }}
            >
              <UploadCloud size={16} color="#6366f1" />
              <span>Upload Resume</span>
            </button>
          </div>

          {/* Thin divider with transparent-to-white subtle gradient */}
          <div style={{
            height: '1px',
            width: '100%',
            maxWidth: '1360px',
            margin: '0.5rem auto 0 auto',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%)'
          }} />
        </header>

        {/* ================================================== */}
        {/* 3. HERO CENTERED HEADLINE & ACTIONS               */}
        {/* ================================================== */}
        <div style={{ 
          position: 'relative', 
          zIndex: 10, 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center',
          textAlign: 'center',
          padding: '2rem 1.5rem',
          maxWidth: '1000px',
          margin: '0 auto',
          width: '100%'
        }}>
          
          {/* Centered Dark Blurred Shape behind headline (Preserves video visibility without full overlay) */}
          <div className="hero-headline-backdrop" />

          {/* Foreground Hero Content (Above backdrop blur) */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* Minimalist Pill Badge */}
            <div 
              className="liquid-glass"
              style={{
                borderRadius: '9999px',
                padding: '6px 18px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: 'hsl(var(--fg-secondary-hsl))',
                marginBottom: '1.75rem',
                border: '1px solid rgba(168, 85, 247, 0.25)'
              }}
            >
              <Sparkles size={14} color="#a855f7" />
              <span>Resume-Grounded AI Technical Interviewer</span>
            </div>

            {/* Oversized Headline in General Sans */}
            <h1 style={{
              fontFamily: 'var(--font-headline)',
              fontSize: 'clamp(3rem, 7.5vw, 6rem)',
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: '-0.035em',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.1em'
            }}>
              <span style={{ color: 'hsl(var(--fg-hsl))' }}>Your Work.</span>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #22d3ee 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Your Interview.
              </span>
            </h1>

            {/* Subtitle */}
            <p style={{
              color: 'hsl(var(--fg-secondary-hsl))',
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              maxWidth: '640px',
              lineHeight: 1.55,
              fontWeight: 400,
              marginBottom: '2.5rem'
            }}>
              Practice technical interviews grounded in your resume, your projects, and the technologies you've actually worked with.
            </p>

            {/* Hero Actions (Primary & Secondary CTAs) */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              
              {/* Primary CTA: Prominent rounded pill button triggering real upload */}
              <button 
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  } else {
                    setIsUploadModalOpen(true);
                  }
                }}
                className="btn-hero-pill"
              >
                <UploadCloud size={20} />
                <span>Upload Your Resume</span>
              </button>

              {/* Secondary CTA: Transparent liquid-glass button scrolling to how it works */}
              <a 
                href="#how-it-works"
                className="liquid-glass"
                style={{
                  borderRadius: '9999px',
                  padding: '16px 32px',
                  color: 'hsl(var(--fg-hsl))',
                  fontWeight: 600,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <span>See How It Works</span>
                <ChevronRight size={18} color="hsl(var(--fg-secondary-hsl))" />
              </a>
            </div>

          </div>
        </div>

        {/* ================================================== */}
        {/* 4. CAPABILITIES MARQUEE (PINNED NEAR BOTTOM)       */}
        {/* ================================================== */}
        <div style={{
          position: 'relative',
          zIndex: 20,
          width: '100%',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(6, 2, 15, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '1.25rem 2rem',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          alignItems: 'center',
          gap: '2.5rem'
        }} className="marquee-wrapper">
          
          {/* Left Pinned Label */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            whiteSpace: 'nowrap',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: 'hsl(var(--fg-secondary-hsl))',
            textTransform: 'uppercase',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            paddingRight: '2rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22d3ee',
              boxShadow: '0 0 10px #22d3ee'
            }} />
            <span>BUILT AROUND YOUR EXPERIENCE</span>
          </div>

          {/* Right Scrolling Infinite Marquee */}
          <div className="marquee-container" style={{ width: '100%' }}>
            <div className="marquee-track">
              {/* Loop Sequence Set 1 */}
              {capabilities.map((cap, i) => (
                <div 
                  key={`cap-1-${i}`}
                  className="liquid-glass"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 18px',
                    borderRadius: '9999px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'hsl(var(--fg-hsl))',
                  }}
                >
                  {cap.icon}
                  <span>{cap.label}</span>
                </div>
              ))}

              {/* Loop Sequence Set 2 (for seamless infinite loop) */}
              {capabilities.map((cap, i) => (
                <div 
                  key={`cap-2-${i}`}
                  className="liquid-glass"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 18px',
                    borderRadius: '9999px',
                    whiteSpace: 'nowrap',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    color: 'hsl(var(--fg-hsl))',
                  }}
                >
                  {cap.icon}
                  <span>{cap.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ================================================== */}
      {/* 5. BELOW-THE-FOLD: HOW IT WORKS SECTION            */}
      {/* ================================================== */}
      <section id="how-it-works" style={{ 
        padding: '7rem 2rem 5rem 2rem', 
        maxWidth: '1240px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 4.5rem auto' }}>
          <div 
            className="liquid-glass"
            style={{
              borderRadius: '9999px',
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#22d3ee',
              marginBottom: '1rem',
              border: '1px solid rgba(34, 211, 238, 0.3)'
            }}
          >
            <Zap size={14} />
            <span>Voice-First Technical Flow</span>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: '1rem',
          }}>
            How It Works
          </h2>
          <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '1.1rem', lineHeight: 1.6 }}>
            A precision-engineered technical assessment pipeline that replaces canned quiz questions with deep, grounded inquiry.
          </p>
        </div>

        {/* 6 Step Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.75rem',
        }}>
          
          {/* Step 1 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6366f1', letterSpacing: '0.1em' }}>STEP 01</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UploadCloud size={20} color="#6366f1" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Upload Your Resume</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Provide your existing technical resume in PDF format. Text extraction uses a resilient multi-tier fallback parser to capture every skill and project.
            </p>
          </div>

          {/* Step 2 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#a855f7', letterSpacing: '0.1em' }}>STEP 02</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cpu size={20} color="#a855f7" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Extract Experience & Projects</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              IntervAI parses technologies, libraries, architectures, work history, and project URLs into a structured Candidate Context Dossier.
            </p>
          </div>

          {/* Step 3 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22d3ee', letterSpacing: '0.1em' }}>STEP 03</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(34, 211, 238, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <GitBranch size={20} color="#22d3ee" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Inspect GitHub Repositories</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Linked public GitHub repositories are inspected automatically, extracting `README.md` documentation and directory structure for code-level grounding.
            </p>
          </div>

          {/* Step 4 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ec4899', letterSpacing: '0.1em' }}>STEP 04</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={20} color="#ec4899" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Choose Interview Style</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Select between FAANG, MANGOS, or Big 4 presets to calibrate whether questions probe algorithmic complexity, distributed systems, or enterprise reliability.
            </p>
          </div>

          {/* Step 5 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6366f1', letterSpacing: '0.1em' }}>STEP 05</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={20} color="#6366f1" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Voice Interview</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              The AI speaks questions aloud. You speak naturally into your microphone. Automatic Voice Activity Detection (VAD) captures your technical answers seamlessly.
            </p>
          </div>

          {/* Step 6 */}
          <div className="liquid-glass" style={{ padding: '2rem', borderRadius: '18px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.1em' }}>STEP 06</span>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} color="#10b981" />
              </div>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Receive Evaluation Report</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Review your overall technical score (0–100), key strengths, growth areas, and turn-by-turn feedback analyzing your responses against grounding sources.
            </p>
          </div>

        </div>
      </section>

      {/* ================================================== */}
      {/* 6. BELOW-THE-FOLD: INTERVIEW STYLES SECTION        */}
      {/* ================================================== */}
      <section id="interview-styles" style={{ 
        padding: '5rem 2rem', 
        maxWidth: '1240px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 4rem auto' }}>
          <div 
            className="liquid-glass"
            style={{
              borderRadius: '9999px',
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#a855f7',
              marginBottom: '1rem',
              border: '1px solid rgba(168, 85, 247, 0.3)'
            }}
          >
            <Layers size={14} />
            <span>Configurable Probing Presets</span>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: '1rem',
          }}>
            Choose Your Interview Style
          </h2>
          <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Each preset changes <em>how</em> the interviewer probes technical depth, while your resume and projects dictate <em>what</em> is asked. No irrelevant topics or HR questions.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
        }}>
          
          {/* FAANG Card */}
          <div className="liquid-glass" style={{ 
            padding: '2.5rem 2rem', 
            borderRadius: '20px', 
            border: '1px solid rgba(6, 182, 212, 0.3)',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#06b6d4', letterSpacing: '-0.02em' }}>FAANG</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
                Depth & Algorithms
              </span>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary-hsl))' }}>
              <strong>Companies:</strong> Meta, Amazon, Apple, Netflix, Google
            </div>

            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Emphasizes computational complexity, runtime bounds, data structure selections, implementation choices, boundary edge cases, and runtime optimizations grounded in your projects.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#06b6d4" />
                <span>Time & space complexity analysis</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#06b6d4" />
                <span>Boundary input & edge-case handling</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#06b6d4" />
                <span>Low-level mechanics & data structures</span>
              </li>
            </ul>
          </div>

          {/* MANGOS Card */}
          <div className="liquid-glass" style={{ 
            padding: '2.5rem 2rem', 
            borderRadius: '20px', 
            border: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6', letterSpacing: '-0.02em' }}>MANGOS</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6' }}>
                Frontier AI & Systems
              </span>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary-hsl))' }}>
              <strong>Companies:</strong> Meta, Anthropic, NVIDIA, Google, OpenAI, SpaceX
            </div>

            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Emphasizes architectural reasoning, AI/ML models, distributed scale, memory bottlenecks, failure modes under latency spikes, and first-principles design decisions evidenced by your work.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#8b5cf6" />
                <span>Distributed architecture & scale trade-offs</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#8b5cf6" />
                <span>AI/ML models, embeddings & compute bounds</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#8b5cf6" />
                <span>Degraded dependencies & fault recovery</span>
              </li>
            </ul>
          </div>

          {/* Big 4 Card */}
          <div className="liquid-glass" style={{ 
            padding: '2.5rem 2rem', 
            borderRadius: '20px', 
            border: '1px solid rgba(16, 185, 129, 0.3)',
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', letterSpacing: '-0.02em' }}>Big 4</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                Enterprise & Practical SE
              </span>
            </div>
            
            <div style={{ fontSize: '0.85rem', color: 'hsl(var(--fg-secondary-hsl))' }}>
              <strong>Companies:</strong> Deloitte, PwC, EY, KPMG
            </div>

            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.925rem', lineHeight: 1.6 }}>
              Emphasizes practical software engineering, database schemas and query indexing, API contracts, error validation, debugging workflows, and business-relevant operational constraints.
            </p>

            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Database modeling & query integrity</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>API contracts & validation patterns</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'hsl(var(--fg-hsl))' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>Production debugging & logging standards</span>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* ================================================== */}
      {/* 7. BELOW-THE-FOLD: FEATURES / HOW IT IS DIFFERENT  */}
      {/* ================================================== */}
      <section id="features" style={{ 
        padding: '5rem 2rem 8rem 2rem', 
        maxWidth: '1240px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 10
      }}>
        
        <div style={{ textAlign: 'center', maxWidth: '750px', margin: '0 auto 4.5rem auto' }}>
          <div 
            className="liquid-glass"
            style={{
              borderRadius: '9999px',
              padding: '6px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#6366f1',
              marginBottom: '1rem',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}
          >
            <ShieldCheck size={14} />
            <span>Architectural Differentiators</span>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            marginBottom: '1rem',
          }}>
            How IntervAI Is Different
          </h2>
          <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '1.1rem', lineHeight: 1.6 }}>
            Designed from first principles to simulate an actual senior engineering lead interviewing you about your past technical work.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
        }}>
          
          <div className="liquid-glass" style={{ padding: '2.5rem', borderRadius: '22px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Code2 size={24} color="#6366f1" />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem' }}>Resume-Grounded Questions</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.95rem', lineHeight: 1.65 }}>
              Zero generic LeetCode puzzles or static textbook trivia. Every single question directly attributes to technologies, frameworks, and projects listed on your resume.
            </p>
          </div>

          <div className="liquid-glass" style={{ padding: '2.5rem', borderRadius: '22px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <GitPullRequest size={24} color="#a855f7" />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem' }}>Project-Aware Follow-Ups</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.95rem', lineHeight: 1.65 }}>
              By inspecting your public GitHub README files and codebase structure, the interviewer probes your specific architectural choices, trade-offs, and boundary scenarios.
            </p>
          </div>

          <div className="liquid-glass" style={{ padding: '2.5rem', borderRadius: '22px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(34, 211, 238, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <Mic size={24} color="#22d3ee" />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.75rem' }}>Real-Time Voice Interaction</h3>
            <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.95rem', lineHeight: 1.65 }}>
              Converse naturally without typing into a chatbox. The interviewer speaks aloud and listens through your microphone with low-latency Voice Activity Detection.
            </p>
          </div>

        </div>

        {/* Big Bottom Action Card */}
        <div className="liquid-glass" style={{
          marginTop: '5rem',
          padding: '4rem 2rem',
          borderRadius: '28px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(22, 17, 44, 0.6) 0%, rgba(9, 6, 20, 0.8) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem'
        }}>
          <h2 style={{
            fontFamily: 'var(--font-headline)',
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em'
          }}>
            Ready to test your technical depth?
          </h2>
          <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '1.1rem', maxWidth: '600px' }}>
            Upload your resume and experience an adaptive, voice-first technical interview calibrated to your real experience.
          </p>
          <button 
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.click();
              } else {
                setIsUploadModalOpen(true);
              }
            }}
            className="btn-hero-pill"
            style={{ marginTop: '0.5rem' }}
          >
            <UploadCloud size={20} />
            <span>Upload Your Resume</span>
          </button>
        </div>
      </section>

      {/* ================================================== */}
      {/* 8. FOOTER                                          */}
      {/* ================================================== */}
      <footer style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '3rem 2rem',
        maxWidth: '1240px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        alignItems: 'center',
        textAlign: 'center',
        color: 'hsl(var(--fg-secondary-hsl))',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AudioWaveform size={18} color="#22d3ee" />
          <span style={{ fontFamily: 'var(--font-headline)', fontWeight: 800, color: 'hsl(var(--fg-hsl))', fontSize: '1.1rem' }}>
            IntervAI
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>•</span>
          <span>Resume-Grounded AI Technical Interviewer</span>
        </div>

        <p style={{ maxWidth: '700px', lineHeight: 1.5, color: 'rgba(243, 242, 240, 0.5)', fontSize: '0.8rem' }}>
          IntervAI is an independent practice product designed for senior engineering interview preparation. Company presets are informal stylistic guidelines inspired by general public interview preparation and are not affiliated with or endorsed by named companies.
        </p>

        <div>
          © {new Date().getFullYear()} IntervAI. Your Work. Your Interview.
        </div>
      </footer>

      {/* ================================================== */}
      {/* 9. REAL UPLOAD MODAL / DROPZONE OVERLAY            */}
      {/* ================================================== */}
      {isUploadModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          backgroundColor: 'rgba(6, 2, 15, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div 
            className="liquid-glass"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '2.5rem',
              borderRadius: '24px',
              position: 'relative',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(168, 85, 247, 0.3)'
            }}
          >
            {/* Close Button */}
            <button 
              onClick={() => {
                if (!isUploading) {
                  setIsUploadModalOpen(false);
                  setErrorMessage(null);
                }
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                color: 'hsl(var(--fg-secondary-hsl))'
              }}
            >
              <X size={16} />
            </button>

            {/* Modal Title */}
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <UploadCloud size={28} color="#22d3ee" />
              </div>
              <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                Upload Your Technical Resume
              </h3>
              <p style={{ color: 'hsl(var(--fg-secondary-hsl))', fontSize: '0.9rem' }}>
                Your resume is parsed privately to ground interview questions in your real projects.
              </p>
            </div>

            {/* Dropzone container */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragOver ? '2px dashed #22d3ee' : '1px dashed rgba(255, 255, 255, 0.2)',
                backgroundColor: isDragOver ? 'rgba(34, 211, 238, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                borderRadius: '16px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginBottom: '1.5rem'
              }}
            >
              <FileText size={32} color={file ? '#22d3ee' : '#a855f7'} style={{ margin: '0 auto 0.75rem auto' }} />
              {file ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'hsl(var(--fg-hsl))' }}>{file.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary-hsl))', marginTop: '4px' }}>
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready for parsing
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'hsl(var(--fg-hsl))' }}>
                    Click to select or drag and drop your PDF resume
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'hsl(var(--fg-secondary-hsl))', marginTop: '4px' }}>
                    Supported format: PDF up to 10MB
                  </div>
                </div>
              )}
            </div>

            {/* Error Message if any */}
            {errorMessage && (
              <div style={{
                marginBottom: '1.25rem',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) {
                    setIsUploadModalOpen(false);
                    setErrorMessage(null);
                  }
                }}
                disabled={isUploading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '10px 20px',
                  color: 'hsl(var(--fg-secondary-hsl))',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: isUploading ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="btn-hero-pill"
                style={{
                  padding: '12px 28px',
                  fontSize: '0.95rem',
                  opacity: (!file || isUploading) ? 0.6 : 1,
                  cursor: (!file || isUploading) ? 'not-allowed' : 'pointer'
                }}
              >
                {isUploading ? (
                  <>
                    <Cpu size={18} className="spin-icon" />
                    <span>Extracting & Parsing...</span>
                  </>
                ) : (
                  <>
                    <span>Start Interview Prep</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded CSS for responsive tweaks */}
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1.5s linear infinite;
        }
        @media (max-width: 820px) {
          .nav-center-links {
            display: none !important;
          }
          .marquee-wrapper {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}
