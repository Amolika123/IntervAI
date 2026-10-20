'use client';

import React, { useEffect, useState } from 'react';

interface RobotHelmetProps {
  className?: string;
}

export default function RobotHelmet({ className = '' }: RobotHelmetProps) {
  // Support replaying entrance on route returns without duplicating SVG nodes
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    // Increment animKey on mount / navigation restore
    setAnimKey((prev) => prev + 1);
  }, []);

  return (
    <div className={`robot-helmet-container ${className}`}>
      <svg
        key={animKey}
        viewBox="0 0 660 680"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="robot-helmet-svg"
        aria-labelledby="robot-helmet-title robot-helmet-desc"
        role="img"
      >
        <title id="robot-helmet-title">IntervAI Autonomous Technical Interviewer Robotic Helmet</title>
        <desc id="robot-helmet-desc">
          A precision-engineered futuristic white robot helmet with a deep navy panoramic visor, electric-blue mechanical seams, and segmented articulated armour plates.
        </desc>

        <defs>
          {/* Soft Edge drop shadow filter */}
          <filter id="softEdge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
            <feOffset dx="0" dy="10" result="offset" />
            <feComponentTransfer in="offset" result="softOffset">
              <feFuncA type="linear" slope="0.25" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="softOffset" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Electric Blue Glow filter */}
          <filter id="electricGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradients */}
          <linearGradient id="whiteShell" x1="160" y1="80" x2="500" y2="580" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f8fafc" />
            <stop offset="70%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="whiteShellLight" x1="330" y1="60" x2="330" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>

          <linearGradient id="whiteShellShadow" x1="330" y1="300" x2="330" y2="620" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          <linearGradient id="navyVisor" x1="200" y1="180" x2="460" y2="380" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#060c1a" />
            <stop offset="35%" stopColor="#0b1736" />
            <stop offset="70%" stopColor="#081430" />
            <stop offset="100%" stopColor="#040814" />
          </linearGradient>

          <linearGradient id="visorSheen" x1="220" y1="200" x2="440" y2="340" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="25%" stopColor="rgba(0, 210, 255, 0.22)" />
            <stop offset="60%" stopColor="rgba(0, 102, 255, 0.05)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
          </linearGradient>

          <linearGradient id="electricBlueSeam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00f5ff" />
            <stop offset="50%" stopColor="#0080ff" />
            <stop offset="100%" stopColor="#00e5ff" />
          </linearGradient>

          <linearGradient id="earMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e2e8f0" />
            <stop offset="80%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id="darkVent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* 1. REAR CROWN PANELS (900ms, delay 240ms) */}
        <g className="assembly-part part-rear-crown" filter="url(#softEdge)">
          {/* Main Rear Dome */}
          <path
            d="M 185 240 C 185 130, 245 75, 330 75 C 415 75, 475 130, 475 240 L 485 300 C 485 320, 470 340, 455 345 L 450 250 C 450 160, 400 115, 330 115 C 260 115, 210 160, 210 250 L 205 345 C 190 340, 175 320, 175 300 Z"
            fill="url(#whiteShellLight)"
            stroke="#94a3b8"
            strokeWidth="1.2"
          />
          {/* Rear Occipital Plate */}
          <path
            d="M 215 150 C 250 100, 410 100, 445 150 L 465 230 C 465 240, 455 250, 440 245 C 400 230, 260 230, 220 245 C 205 250, 195 240, 195 230 Z"
            fill="url(#whiteShell)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Rear aerodynamic cowl vents */}
          <path d="M 240 125 L 265 140 L 260 170 L 235 155 Z" fill="#94a3b8" opacity="0.6" />
          <path d="M 420 125 L 395 140 L 400 170 L 425 155 Z" fill="#94a3b8" opacity="0.6" />
          {/* Upper Crest Bevel Line */}
          <path
            d="M 230 105 C 280 82, 380 82, 430 105"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* 2. SIDE EAR HOUSINGS (820ms, delay 340ms) */}
        <g className="assembly-part part-ear-housings" filter="url(#softEdge)">
          {/* Left Ear Housing */}
          <g className="ear-left">
            {/* Outer Bevel Shell */}
            <path
              d="M 175 255 L 145 270 L 135 320 L 155 365 L 185 360 L 195 310 Z"
              fill="url(#earMetal)"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            {/* Circular Audio Sensor Mount */}
            <circle cx="160" cy="315" r="24" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="160" cy="315" r="16" fill="url(#navyVisor)" />
            {/* Electric Blue Core Ring */}
            <circle
              cx="160"
              cy="315"
              r="10"
              fill="none"
              stroke="url(#electricBlueSeam)"
              strokeWidth="2.5"
              filter="url(#electricGlow)"
            />
            {/* Sensor Slits */}
            <line x1="135" y1="285" x2="148" y2="295" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="135" y1="345" x2="148" y2="335" stroke="#94a3b8" strokeWidth="1.5" />
          </g>

          {/* Right Ear Housing */}
          <g className="ear-right">
            {/* Outer Bevel Shell */}
            <path
              d="M 485 255 L 515 270 L 525 320 L 505 365 L 475 360 L 465 310 Z"
              fill="url(#earMetal)"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            {/* Circular Audio Sensor Mount */}
            <circle cx="500" cy="315" r="24" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
            <circle cx="500" cy="315" r="16" fill="url(#navyVisor)" />
            {/* Electric Blue Core Ring */}
            <circle
              cx="500"
              cy="315"
              r="10"
              fill="none"
              stroke="url(#electricBlueSeam)"
              strokeWidth="2.5"
              filter="url(#electricGlow)"
            />
            {/* Sensor Slits */}
            <line x1="525" y1="285" x2="512" y2="295" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="525" y1="345" x2="512" y2="335" stroke="#94a3b8" strokeWidth="1.5" />
          </g>
        </g>

        {/* 3. JAW PLATES & LOWER CHEEK ARMOUR (880ms, delay 430ms) */}
        <g className="assembly-part part-jaw-plates" filter="url(#softEdge)">
          {/* Left Mandibular Plate */}
          <path
            d="M 185 360 L 225 365 L 255 410 L 268 495 L 235 530 L 195 490 L 175 420 Z"
            fill="url(#whiteShell)"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {/* Left Plate Chamfered Inset Detail */}
          <path
            d="M 200 380 L 225 385 L 245 420 L 255 480 L 230 508 L 205 480 Z"
            fill="url(#whiteShellLight)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Left Cheek Air Intake Recess */}
          <polygon points="195,435 210,432 212,460 198,465" fill="#1e293b" />

          {/* Right Mandibular Plate */}
          <path
            d="M 475 360 L 435 365 L 405 410 L 392 495 L 425 530 L 465 490 L 485 420 Z"
            fill="url(#whiteShell)"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {/* Right Plate Chamfered Inset Detail */}
          <path
            d="M 460 380 L 435 385 L 415 420 L 405 480 L 430 508 L 455 480 Z"
            fill="url(#whiteShellLight)"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {/* Right Cheek Air Intake Recess */}
          <polygon points="465,435 450,432 448,460 462,465" fill="#1e293b" />
        </g>

        {/* 4. CENTRE JAW SECTION (920ms, delay 500ms) */}
        <g className="assembly-part part-centre-jaw" filter="url(#softEdge)">
          {/* Central Chin Shield */}
          <polygon
            points="272,490 330,465 388,490 395,550 355,595 305,595 265,550"
            fill="url(#whiteShellLight)"
            stroke="#94a3b8"
            strokeWidth="1.8"
          />
          {/* Lower Chin Bevel Point */}
          <polygon
            points="305,595 330,622 355,595 330,578"
            fill="url(#whiteShellShadow)"
            stroke="#64748b"
            strokeWidth="1.2"
          />
          {/* Central Intake Plate */}
          <polygon
            points="292,510 330,495 368,510 362,560 330,575 298,560"
            fill="url(#darkVent)"
            stroke="#334155"
            strokeWidth="1.5"
          />
          {/* Chin Vent Slats */}
          <line x1="306" y1="525" x2="354" y2="525" stroke="#00f0ff" strokeWidth="2" opacity="0.8" />
          <line x1="310" y1="538" x2="350" y2="538" stroke="#0080ff" strokeWidth="2" opacity="0.8" />
          <line x1="316" y1="550" x2="344" y2="550" stroke="#00f0ff" strokeWidth="1.8" opacity="0.8" />
        </g>

        {/* 5. VISOR (920ms, delay 560ms) */}
        <g className="assembly-part part-visor" filter="url(#softEdge)">
          {/* Deep Navy High-Tech Curved Visor */}
          <path
            d="M 180 255 C 195 210, 255 185, 330 185 C 405 185, 465 210, 480 255 C 492 290, 480 348, 436 368 C 385 390, 275 390, 224 368 C 180 348, 168 290, 180 255 Z"
            fill="url(#navyVisor)"
            stroke="#0b1736"
            strokeWidth="2.5"
          />
          {/* Visor Glare / High-Gloss Arc */}
          <path
            d="M 205 245 C 240 215, 290 200, 330 200 C 370 200, 420 215, 455 245 C 420 230, 370 220, 330 220 C 290 220, 240 230, 205 245 Z"
            fill="url(#visorSheen)"
          />
          {/* Secondary Gloss Sweep */}
          <path
            d="M 195 285 C 215 255, 270 240, 330 240 C 390 240, 445 255, 465 285 C 430 270, 380 262, 330 262 C 280 262, 230 270, 195 285 Z"
            fill="rgba(255, 255, 255, 0.12)"
          />
          {/* Internal HUD Telemetry Horizontal Scanline */}
          <path
            d="M 230 310 L 290 310 L 305 325 L 355 325 L 370 310 L 430 310"
            stroke="url(#electricBlueSeam)"
            strokeWidth="1.8"
            strokeLinecap="round"
            filter="url(#electricGlow)"
            opacity="0.85"
          />
          <circle cx="330" cy="325" r="3" fill="#00f5ff" filter="url(#electricGlow)" />
        </g>

        {/* 6. CROWN FIN (960ms, delay 620ms) */}
        <g className="assembly-part part-crown-fin" filter="url(#softEdge)">
          {/* Aerodynamic Dorsal Crest Fin */}
          <path
            d="M 324 45 L 336 45 L 342 185 L 330 198 L 318 185 Z"
            fill="url(#whiteShellLight)"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {/* Fin Top Ridge */}
          <polygon points="324,45 330,35 336,45" fill="#cbd5e1" stroke="#64748b" strokeWidth="1" />
          {/* Center Fin Spine Highlight */}
          <line x1="330" y1="45" x2="330" y2="185" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          {/* Brow Fin Cap Anchor */}
          <polygon points="314,185 330,205 346,185 330,175" fill="#475569" stroke="#00f0ff" strokeWidth="1" />
        </g>

        {/* 7. ELECTRIC-BLUE PANEL SEAMS (620ms, delay 920ms) */}
        <g className="assembly-part part-blue-seams" filter="url(#electricGlow)">
          {/* Brow/Visor Seam */}
          <path
            d="M 205 215 C 245 190, 310 182, 330 182 C 350 182, 415 190, 455 215"
            stroke="url(#electricBlueSeam)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Fin Side Accent Seams */}
          <line x1="322" y1="65" x2="322" y2="165" stroke="#00f5ff" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="338" y1="65" x2="338" y2="165" stroke="#00f5ff" strokeWidth="1.8" strokeLinecap="round" />
          {/* Cheek Seam Curves */}
          <path
            d="M 185 360 L 225 365 L 255 410 L 272 490"
            stroke="url(#electricBlueSeam)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M 475 360 L 435 365 L 405 410 L 388 490"
            stroke="url(#electricBlueSeam)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Chin Junction Seams */}
          <path
            d="M 272 490 L 330 465 L 388 490"
            stroke="url(#electricBlueSeam)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Temple Energy Nodes */}
          <circle cx="218" cy="225" r="2.5" fill="#ffffff" />
          <circle cx="442" cy="225" r="2.5" fill="#ffffff" />
        </g>

        {/* 8. FACE DETAILS & CHIN VENTS (680ms, delay 1020ms) */}
        <g className="assembly-part part-face-details">
          {/* Forehead Sensor Cluster */}
          <circle cx="310" cy="155" r="2.5" fill="#334155" />
          <circle cx="350" cy="155" r="2.5" fill="#334155" />
          <circle cx="330" cy="145" r="3" fill="#00f0ff" filter="url(#electricGlow)" />
          {/* Brow Alignment Marks */}
          <line x1="280" y1="180" x2="295" y2="180" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="365" y1="180" x2="380" y2="180" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
          {/* Jaw Micro Pins */}
          <circle cx="245" cy="425" r="2" fill="#64748b" />
          <circle cx="415" cy="425" r="2" fill="#64748b" />
          <circle cx="258" cy="485" r="2" fill="#64748b" />
          <circle cx="402" cy="485" r="2" fill="#64748b" />
          {/* Chin Indicator Status Light */}
          <circle cx="330" cy="582" r="3.5" fill="#00f0ff" filter="url(#electricGlow)" />
        </g>
      </svg>

      <style jsx>{`
        .robot-helmet-container {
          position: relative;
          width: 100%;
          height: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .robot-helmet-svg {
          width: 100%;
          height: auto;
          max-height: 80svh;
          display: block;
          filter: drop-shadow(0 20px 45px rgba(0, 20, 80, 0.45));
        }

        /* -------------------------------------------------------------
           COORDINATED MECHANICAL ASSEMBLY ANIMATIONS
           Exact timings and delays specified by Future Machine template
           ------------------------------------------------------------- */
        .assembly-part {
          transform-box: fill-box;
          transform-origin: center center;
          will-change: transform, opacity;
          animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
          animation-fill-mode: both;
        }

        /* 1. Rear crown panels: 900ms, delay 240ms */
        .part-rear-crown {
          animation-name: assemble-rear-crown;
          animation-duration: 900ms;
          animation-delay: 240ms;
        }
        @keyframes assemble-rear-crown {
          0% {
            opacity: 0;
            transform: translateY(-45px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* 2. Ear housings: 820ms, delay 340ms */
        .part-ear-housings {
          animation-name: assemble-ear-housings;
          animation-duration: 820ms;
          animation-delay: 340ms;
        }
        @keyframes assemble-ear-housings {
          0% {
            opacity: 0;
            transform: scale(0.85);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        .ear-left {
          animation: assemble-ear-left 820ms cubic-bezier(0.16, 1, 0.3, 1) 340ms both;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes assemble-ear-left {
          0% {
            opacity: 0;
            transform: translateX(-55px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .ear-right {
          animation: assemble-ear-right 820ms cubic-bezier(0.16, 1, 0.3, 1) 340ms both;
          transform-box: fill-box;
          transform-origin: center;
        }
        @keyframes assemble-ear-right {
          0% {
            opacity: 0;
            transform: translateX(55px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* 3. Jaw plates: 880ms, delay 430ms */
        .part-jaw-plates {
          animation-name: assemble-jaw-plates;
          animation-duration: 880ms;
          animation-delay: 430ms;
        }
        @keyframes assemble-jaw-plates {
          0% {
            opacity: 0;
            transform: translateY(35px) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* 4. Centre jaw: 920ms, delay 500ms */
        .part-centre-jaw {
          animation-name: assemble-centre-jaw;
          animation-duration: 920ms;
          animation-delay: 500ms;
        }
        @keyframes assemble-centre-jaw {
          0% {
            opacity: 0;
            transform: translateY(45px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 5. Visor: 920ms, delay 560ms */
        .part-visor {
          animation-name: assemble-visor;
          animation-duration: 920ms;
          animation-delay: 560ms;
        }
        @keyframes assemble-visor {
          0% {
            opacity: 0;
            transform: translateY(-30px) scale(1.05);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* 6. Crown fin: 960ms, delay 620ms */
        .part-crown-fin {
          animation-name: assemble-crown-fin;
          animation-duration: 960ms;
          animation-delay: 620ms;
        }
        @keyframes assemble-crown-fin {
          0% {
            opacity: 0;
            transform: translateY(-60px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* 7. Blue seams: 620ms, delay 920ms */
        .part-blue-seams {
          animation-name: assemble-blue-seams;
          animation-duration: 620ms;
          animation-delay: 920ms;
        }
        @keyframes assemble-blue-seams {
          0% {
            opacity: 0;
            filter: drop-shadow(0 0 0px transparent);
          }
          60% {
            opacity: 1;
            filter: drop-shadow(0 0 12px #00f0ff);
          }
          100% {
            opacity: 1;
            filter: drop-shadow(0 0 4px #00f0ff);
          }
        }

        /* 8. Face details: 680ms, delay 1020ms */
        .part-face-details {
          animation-name: assemble-face-details;
          animation-duration: 680ms;
          animation-delay: 1020ms;
        }
        @keyframes assemble-face-details {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Reduced Motion: Immediate appearance without translation */
        @media (prefers-reduced-motion: reduce) {
          .assembly-part,
          .ear-left,
          .ear-right {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
