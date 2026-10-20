'use client';

import React, { useState, useEffect, useRef } from 'react';

interface NavHeaderProps {
  onUploadResume: () => void;
}

export default function NavHeader({ onUploadResume }: NavHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const openBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus management & Escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
        openBtnRef.current?.focus({ preventScroll: true });
      }
    };

    if (isMobileMenuOpen) {
      closeBtnRef.current?.focus({ preventScroll: true });
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  const handleLinkClick = (hash: string) => {
    setIsMobileMenuOpen(false);
    openBtnRef.current?.focus({ preventScroll: true });
    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <header className="fm-nav-header" role="banner">
        <div className="fm-nav-inner">
          {/* Dominant Top-Left Brand */}
          <div className="fm-brand-wrap">
            <h1 className="fm-nav-brand">
              <a href="#" className="fm-brand-link" aria-label="IntervAI Home">
                IntervAI
              </a>
            </h1>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="fm-desktop-nav" aria-label="Main Navigation">
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#how-it-works');
              }}
              className="fm-nav-link"
            >
              How It Works
            </a>
            <a
              href="#interview-styles"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#interview-styles');
              }}
              className="fm-nav-link"
            >
              Interview Styles
            </a>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#features');
              }}
              className="fm-nav-link"
            >
              Features
            </a>
            <button
              type="button"
              onClick={onUploadResume}
              className="fm-nav-upload-btn"
              aria-label="Upload your resume to begin interview"
            >
              <span className="fm-upload-dot" aria-hidden="true" />
              <span>Upload Resume</span>
            </button>
          </nav>

          {/* Mobile Hamburger Trigger */}
          <button
            ref={openBtnRef}
            type="button"
            className="fm-mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open mobile menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="fm-mobile-drawer"
          >
            <svg
              width="24"
              height="18"
              viewBox="0 0 24 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="2" y1="2" x2="22" y2="2" />
              <line x1="2" y1="8" x2="22" y2="8" />
              <line x1="2" y1="14" x2="22" y2="14" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        id="fm-mobile-drawer"
        className={`fm-mobile-drawer ${isMobileMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div
          className="fm-drawer-backdrop"
          onClick={() => {
            setIsMobileMenuOpen(false);
            openBtnRef.current?.focus({ preventScroll: true });
          }}
          aria-hidden="true"
        />

        <div className="fm-drawer-panel" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
          <div className="fm-drawer-header">
            <span className="fm-drawer-brand">IntervAI</span>
            <button
              ref={closeBtnRef}
              type="button"
              className="fm-drawer-close"
              onClick={() => {
                setIsMobileMenuOpen(false);
                openBtnRef.current?.focus({ preventScroll: true });
              }}
              aria-label="Close navigation menu"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav className="fm-drawer-nav">
            <a
              href="#how-it-works"
              className="fm-drawer-link"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#how-it-works');
              }}
            >
              <span>How It Works</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              href="#interview-styles"
              className="fm-drawer-link"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#interview-styles');
              }}
            >
              <span>Interview Styles</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
            <a
              href="#features"
              className="fm-drawer-link"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick('#features');
              }}
            >
              <span>Features</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </a>
          </nav>

          <div className="fm-drawer-footer">
            <button
              type="button"
              className="fm-drawer-upload-btn"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onUploadResume();
              }}
            >
              <span>Upload Resume</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .fm-nav-header {
          position: relative;
          z-index: 30;
          width: 100%;
          padding: 1.75rem 2.5rem;
          color: #ffffff;
        }

        .fm-nav-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .fm-brand-wrap {
          display: flex;
          align-items: center;
        }

        .fm-nav-brand {
          font-size: clamp(2rem, 3.8vw, 2.85rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          margin: 0;
          color: #ffffff;
        }

        .fm-brand-link {
          color: #ffffff;
          text-decoration: none;
          transition: opacity 200ms ease;
        }

        .fm-brand-link:hover {
          opacity: 0.9;
        }

        .fm-desktop-nav {
          display: none;
          align-items: center;
          gap: 2.25rem;
        }

        @media (min-width: 768px) {
          .fm-desktop-nav {
            display: flex;
          }
        }

        .fm-nav-link {
          font-size: 0.875rem;
          font-weight: 400;
          letter-spacing: 0.025em;
          color: rgba(255, 255, 255, 0.85);
          text-decoration: none;
          transition: color 200ms ease;
        }

        .fm-nav-link:hover {
          color: #ffffff;
        }

        .fm-nav-upload-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.5rem 1.15rem;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 9999px;
          color: #ffffff;
          font-family: inherit;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: background 200ms ease, border-color 200ms ease, opacity 200ms ease;
          -webkit-appearance: none;
          appearance: none;
        }

        .fm-nav-upload-btn:hover {
          background: rgba(255, 255, 255, 0.22);
          border-color: #ffffff;
        }

        .fm-upload-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #00f0ff;
          box-shadow: 0 0 8px #00f0ff;
        }

        .fm-mobile-menu-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 0.5rem;
          outline: none;
        }

        @media (min-width: 768px) {
          .fm-mobile-menu-btn {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .fm-nav-header {
            padding: 1.25rem 1.5rem;
          }
          .fm-nav-brand {
            font-size: 1.85rem;
          }
        }

        /* Mobile Drawer */
        .fm-mobile-drawer {
          position: fixed;
          inset: 0;
          z-index: 100;
          visibility: hidden;
          pointer-events: none;
          transition: visibility 0s linear 300ms;
        }

        .fm-mobile-drawer.is-open {
          visibility: visible;
          pointer-events: auto;
          transition-delay: 0s;
        }

        .fm-drawer-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(2, 12, 35, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 0;
          transition: opacity 300ms ease;
        }

        .fm-mobile-drawer.is-open .fm-drawer-backdrop {
          opacity: 1;
        }

        .fm-drawer-panel {
          position: absolute;
          top: 0;
          right: 0;
          width: 85%;
          max-width: 340px;
          height: 100%;
          background: linear-gradient(180deg, #0753bf 0%, #054199 100%);
          border-left: 1px solid rgba(255, 255, 255, 0.15);
          display: flex;
          flex-direction: column;
          padding: 1.75rem 1.5rem;
          transform: translateX(100%);
          transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .fm-mobile-drawer.is-open .fm-drawer-panel {
          transform: translateX(0);
        }

        .fm-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .fm-drawer-brand {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
        }

        .fm-drawer-close {
          background: none;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 0.25rem;
          outline: none;
        }

        .fm-drawer-nav {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-top: 2rem;
        }

        .fm-drawer-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 1.125rem;
          color: rgba(255, 255, 255, 0.9);
          text-decoration: none;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          transition: color 200ms ease;
        }

        .fm-drawer-link:hover {
          color: #ffffff;
        }

        .fm-drawer-footer {
          margin-top: auto;
          padding-top: 1.5rem;
        }

        .fm-drawer-upload-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1.25rem;
          background: #ffffff;
          color: #0753bf;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          outline: none;
        }
      `}</style>
    </>
  );
}
