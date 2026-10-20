'use client';

import React from 'react';
import Link from 'next/link';

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  badge?: React.ReactNode;
  rightAction?: React.ReactNode;
  maxWidth?: string;
}

export default function PageShell({
  children,
  title,
  badge,
  rightAction,
  maxWidth = '1200px',
}: PageShellProps) {
  return (
    <div className="fm-shell-root">
      {/* Background Soft Radial Illumination */}
      <div className="fm-shell-glow" aria-hidden="true" />

      {/* Decorative Architectural Vertical Rules (Desktop) */}
      <div className="fm-shell-vrule fm-shell-vrule-left" aria-hidden="true">
        <span className="fm-shell-vrule-seg fm-shell-vrule-end" />
        <span className="fm-shell-vrule-plus">+</span>
        <span className="fm-shell-vrule-seg fm-shell-vrule-mid" />
        <span className="fm-shell-vrule-plus">+</span>
        <span className="fm-shell-vrule-seg fm-shell-vrule-end" />
      </div>
      <div className="fm-shell-vrule fm-shell-vrule-right" aria-hidden="true">
        <span className="fm-shell-vrule-seg fm-shell-vrule-end" />
        <span className="fm-shell-vrule-plus">+</span>
        <span className="fm-shell-vrule-seg fm-shell-vrule-mid" />
        <span className="fm-shell-vrule-plus">+</span>
        <span className="fm-shell-vrule-seg fm-shell-vrule-end" />
      </div>

      {/* Persistent Brand Header */}
      <header className="fm-shell-header" role="banner">
        <div className="fm-shell-header-inner">
          <div className="fm-shell-brand-group">
            <Link href="/" className="fm-shell-brand" aria-label="IntervAI Home">
              {/* Mini Futuristic Robot Helmet Icon */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 660 680"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="fm-shell-brand-icon"
                aria-hidden="true"
              >
                <path
                  d="M 185 240 C 185 130, 245 75, 330 75 C 415 75, 475 130, 475 240 L 485 300 C 485 320, 470 340, 455 345 L 450 250 C 450 160, 400 115, 330 115 C 260 115, 210 160, 210 250 L 205 345 C 190 340, 175 320, 175 300 Z"
                  fill="#ffffff"
                />
                <circle cx="160" cy="315" r="30" fill="#94a3b8" />
                <circle cx="500" cy="315" r="30" fill="#94a3b8" />
                <path
                  d="M 180 255 C 195 210, 255 185, 330 185 C 405 185, 465 210, 480 255 C 492 290, 480 348, 436 368 C 385 390, 275 390, 224 368 C 180 348, 168 290, 180 255 Z"
                  fill="#0b1736"
                />
                <path
                  d="M 230 310 L 290 310 L 305 325 L 355 325 L 370 310 L 430 310"
                  stroke="#00f5ff"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <polygon
                  points="272,490 330,465 388,490 395,550 355,595 305,595 265,550"
                  fill="#ffffff"
                />
                <polygon points="305,595 330,622 355,595 330,578" fill="#00d9ff" />
              </svg>
              <span>IntervAI</span>
            </Link>

            {badge && <div className="fm-shell-badge-wrap">{badge}</div>}
          </div>

          {title && <div className="fm-shell-title-center">{title}</div>}

          <div className="fm-shell-right">{rightAction}</div>
        </div>
      </header>

      {/* Main Container */}
      <main className="fm-shell-main" style={{ maxWidth }}>
        {children}
      </main>

      <style jsx>{`
        .fm-shell-root {
          min-height: 100vh;
          width: 100%;
          background-color: #055bd3;
          background-image: linear-gradient(135deg, #0753bf 0%, #0069e9 50%, #0755c4 100%);
          color: #ffffff;
          position: relative;
          overflow-x: hidden;
          font-family: Arial, Helvetica, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .fm-shell-glow {
          position: fixed;
          inset: 0;
          background: radial-gradient(
            circle 700px at 50% 25%,
            rgba(0, 217, 255, 0.18) 0%,
            rgba(7, 83, 191, 0.1) 45%,
            transparent 75%
          );
          pointer-events: none;
          z-index: 1;
        }

        .fm-shell-vrule {
          position: fixed;
          top: 0;
          bottom: 0;
          z-index: 2;
          display: none;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }
        .fm-shell-vrule-left {
          left: 1.5rem;
        }
        .fm-shell-vrule-right {
          right: 1.5rem;
        }
        .fm-shell-vrule-seg {
          width: 1px;
          background: rgba(255, 255, 255, 0.2);
        }
        .fm-shell-vrule-end {
          height: 10%;
        }
        .fm-shell-vrule-mid {
          flex: 1 1 0%;
        }
        .fm-shell-vrule-plus {
          font-size: 0.75rem;
          line-height: 1;
          color: rgba(255, 255, 255, 0.45);
          padding: 0.25rem 0;
        }
        @media (min-width: 1200px) {
          .fm-shell-vrule {
            display: flex;
          }
        }

        .fm-shell-header {
          position: relative;
          z-index: 20;
          width: 100%;
          padding: 1.25rem 2rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(5, 65, 153, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .fm-shell-header-inner {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .fm-shell-brand-group {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-shrink: 0;
        }

        .fm-shell-brand {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: #ffffff;
          text-decoration: none;
          transition: opacity 200ms ease;
        }
        .fm-shell-brand:hover {
          opacity: 0.88;
        }

        .fm-shell-brand-icon {
          flex-shrink: 0;
          filter: drop-shadow(0 2px 8px rgba(0, 217, 255, 0.5));
        }

        .fm-shell-badge-wrap {
          display: flex;
          align-items: center;
        }

        .fm-shell-title-center {
          display: none;
          font-size: 0.9375rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          letter-spacing: 0.01em;
        }
        @media (min-width: 768px) {
          .fm-shell-title-center {
            display: block;
          }
        }

        .fm-shell-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .fm-shell-main {
          position: relative;
          z-index: 10;
          flex: 1;
          width: 100%;
          margin: 0 auto;
          padding: 2.5rem 1.5rem 4rem;
        }

        @media (max-width: 640px) {
          .fm-shell-header {
            padding: 1rem 1.25rem;
          }
          .fm-shell-brand {
            font-size: 1.3rem;
          }
          .fm-shell-main {
            padding: 1.5rem 1rem 3rem;
          }
        }
      `}</style>
    </div>
  );
}
