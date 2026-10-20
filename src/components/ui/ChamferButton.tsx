'use client';

import React from 'react';

interface ChamferButtonProps {
  onClick: () => void;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export default function ChamferButton({
  onClick,
  label = 'Start Your Interview',
  ariaLabel,
  className = '',
}: ChamferButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`future-chamfer-btn ${className}`}
    >
      <span className="chamfer-backing" aria-hidden="true" />
      <svg
        className="chamfer-border-svg"
        viewBox="0 0 280 50"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon
          points="14,0 280,0 280,36 266,50 0,50 0,14"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="chamfer-text">{label}</span>
      <svg
        className="chamfer-arrow"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>

      <style jsx>{`
        .future-chamfer-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.25rem;
          min-width: 240px;
          height: 48px;
          padding: 0 1.5rem;
          background: transparent;
          color: #ffffff;
          border: none;
          font-family: inherit;
          font-size: 0.9375rem;
          font-weight: 500;
          letter-spacing: 0.025em;
          text-decoration: none;
          cursor: pointer;
          outline: none;
          transition: opacity 250ms ease, transform 250ms ease;
          user-select: none;
          -webkit-appearance: none;
          appearance: none;
        }

        .future-chamfer-btn:hover {
          opacity: 0.85;
          transform: translateY(-1px);
        }

        .future-chamfer-btn:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 4px;
        }

        .chamfer-backing {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.08);
          clip-path: polygon(
            14px 0,
            100% 0,
            100% calc(100% - 14px),
            calc(100% - 14px) 100%,
            0 100%,
            0 14px
          );
          transition: background 250ms ease;
        }

        .future-chamfer-btn:hover .chamfer-backing {
          background: rgba(255, 255, 255, 0.16);
        }

        .chamfer-border-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
          pointer-events: none;
        }

        .chamfer-text {
          position: relative;
          z-index: 2;
          white-space: nowrap;
        }

        .chamfer-arrow {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          transition: transform 250ms ease;
        }

        .future-chamfer-btn:hover .chamfer-arrow {
          transform: translateX(4px);
        }

        @media (max-width: 640px) {
          .future-chamfer-btn {
            min-width: 220px;
            height: 44px;
            padding: 0 1.25rem;
            font-size: 0.875rem;
          }
          .chamfer-backing {
            background: rgba(255, 255, 255, 0.18);
          }
        }
      `}</style>
    </button>
  );
}
