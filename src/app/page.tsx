'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileText, Cpu, GitBranch, Mic, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/pdf' && !selected.name.endsWith('.pdf')) {
        setErrorMessage('Please select a valid PDF file.');
        return;
      }
      setFile(selected);
      setErrorMessage(null);
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
      } else {
        setErrorMessage('Only PDF resumes are supported.');
      }
    }
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

      // Store resume data in sessionStorage for smooth transition
      sessionStorage.setItem('resumeData', JSON.stringify(data));
      
      // Navigate to processing view
      router.push(`/processing/${data.resumeId}`);

    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while uploading your resume.');
      setIsUploading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header / Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--gradient-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
          }}>
            <Cpu size={24} color="#ffffff" />
          </div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            Interv<span className="gradient-text">AI</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <ShieldCheck size={16} color="var(--accent-cyan)" />
          <span>Resume-Grounded & Strict Privacy</span>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ textAlign: 'center', maxWidth: '850px', margin: '0 auto 4rem auto' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '30px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          color: 'var(--accent-indigo)',
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}>
          <Sparkles size={16} />
          <span>No Generic Quiz Topics • Grounded Technical Probing</span>
        </div>

        <h1 style={{ fontSize: '3.2rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.25rem', letterSpacing: '-1px' }}>
          Upload your resume. <br />
          <span className="gradient-text">IntervAI understands your projects</span> and conducts a technical interview about your own experience.
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '680px', margin: '0 auto' }}>
          No static topic selection (DSA/DBMS/NLP). IntervAI reads your actual resume, retrieves public GitHub READMEs & code trees, and conducts a real-time voice technical interview.
        </p>
      </section>

      {/* Upload Zone */}
      <section style={{ maxWidth: '680px', margin: '0 auto 5rem auto' }}>
        <div 
          className="glass-panel"
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: isDragOver ? '2px dashed var(--accent-indigo)' : '1px dashed var(--border-color)',
            background: isDragOver ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-surface)',
            transition: 'all 0.3s ease'
          }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto'
          }}>
            <UploadCloud size={32} color="var(--accent-indigo)" />
          </div>

          <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            {file ? file.name : 'Upload your PDF Resume'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.5rem' }}>
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB • Ready for processing` : 'Drag and drop your resume PDF here, or click to browse'}
          </p>

          <input 
            type="file" 
            id="resumeUpload" 
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {!file ? (
            <label htmlFor="resumeUpload" className="btn-secondary" style={{ cursor: 'pointer' }}>
              <FileText size={18} />
              <span>Select PDF File</span>
            </label>
          ) : (
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <label htmlFor="resumeUpload" className="btn-secondary" style={{ cursor: 'pointer' }}>
                Change File
              </label>
              <button 
                onClick={handleUpload} 
                disabled={isUploading}
                className="btn-primary"
              >
                {isUploading ? (
                  <span>Processing Resume...</span>
                ) : (
                  <>
                    <span>Start Interview Prep</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {errorMessage && (
            <div style={{
              marginTop: '1.25rem',
              padding: '10px 16px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.875rem'
            }}>
              {errorMessage}
            </div>
          )}
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '4rem'
      }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--accent-cyan)', marginBottom: '1rem' }}>
            <FileText size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>100% Resume Grounded</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            Every question derives strictly from your resume skills, experience, or projects. No random textbook trivia.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--accent-purple)', marginBottom: '1rem' }}>
            <GitBranch size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>GitHub Project Deep Dive</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            IntervAI inspects public GitHub repository READMEs and file structure to ask deep architectural questions.
          </p>
        </div>

        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--accent-pink)', marginBottom: '1rem' }}>
            <Mic size={28} />
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Realtime Voice Interaction</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem' }}>
            Conducted via low-latency AI voice. Probes trade-offs, edge cases, and scalability dynamically.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        IntervAI • Resume-Grounded Technical Voice Interviewer MVP
      </footer>
    </main>
  );
}
