import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { Zap, X } from 'lucide-react';
import { ChargingOverlayState } from '../hooks/useChargingMode';
import { updateBrowserThemeColor } from '../utils/themeColor';

interface ChargingOverlayProps {
  state: ChargingOverlayState;
  batteryLevel: number | null;
  isPreview?: boolean;
  onClose?: () => void;
}

const ChargingOverlay: React.FC<ChargingOverlayProps> = ({
  state,
  batteryLevel,
  isPreview = false,
  onClose,
}) => {
  const count = useMotionValue(0);
  const [displayPercentage, setDisplayPercentage] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Target battery percentage (0-100)
  const targetPercentage = useMemo(() => {
    if (batteryLevel === null) return 46; // fallback realistic default
    return Math.round(batteryLevel * 100);
  }, [batteryLevel]);

  // Check reduced motion accessibility preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Smooth number counting animation
  useEffect(() => {
    if (state === 'animating') {
      if (prefersReducedMotion) {
        setDisplayPercentage(targetPercentage);
        return;
      }
      const controls = animate(count, targetPercentage, {
        duration: 1.6,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (latest) => {
          setDisplayPercentage(Math.round(latest));
        }
      });
      return () => controls.stop();
    }
  }, [state, targetPercentage, count, prefersReducedMotion]);

  // Dynamically synchronize the PWA status bar theme-color to solid black
  useEffect(() => {
    if (state === 'animating' || state === 'black-screen') {
      updateBrowserThemeColor('#000000');
    } else {
      updateBrowserThemeColor(null);
    }
    return () => {
      updateBrowserThemeColor(null);
    };
  }, [state]);

  // Dynamic Multi-Speed Energy Particles with Variable Velocity (Fast Sparks, Medium Rods, Slow Surges & Micro-Dots)
  const energyParticles = useMemo(() => {
    return [
      // 1. FAST SPARKS (High Velocity: 0.75s - 1.3s, small lengths: 3 - 9px, thin: 1.4 - 2.2px)
      { id: 1, path: 'center-stem', delay: 0.1, speed: 0.9, length: 6, thickness: 1.8, opacity: 1, grad: 'sparkGrad' },
      { id: 2, path: 'left-inner', delay: 0.25, speed: 1.1, length: 8, thickness: 2.0, opacity: 0.95, grad: 'sparkGrad' },
      { id: 3, path: 'right-inner', delay: 0.45, speed: 1.05, length: 7, thickness: 2.0, opacity: 0.95, grad: 'sparkGrad' },
      { id: 4, path: 'left-outer', delay: 0.7, speed: 1.2, length: 9, thickness: 1.8, opacity: 0.9, grad: 'sparkGrad' },
      { id: 5, path: 'right-outer', delay: 0.95, speed: 1.15, length: 8, thickness: 1.8, opacity: 0.9, grad: 'sparkGrad' },
      { id: 6, path: 'center-stem', delay: 0.6, speed: 0.8, length: 4, thickness: 1.5, opacity: 1, grad: 'sparkGrad' },
      { id: 7, path: 'left-far', delay: 0.3, speed: 1.25, length: 7, thickness: 1.6, opacity: 0.85, grad: 'sparkGrad' },
      { id: 8, path: 'right-far', delay: 0.8, speed: 1.3, length: 7, thickness: 1.6, opacity: 0.85, grad: 'sparkGrad' },
      { id: 9, path: 'center-stem', delay: 1.2, speed: 0.75, length: 5, thickness: 1.6, opacity: 1, grad: 'sparkGrad' },
      { id: 10, path: 'left-inner', delay: 1.4, speed: 1.1, length: 6, thickness: 1.9, opacity: 0.9, grad: 'sparkGrad' },
      { id: 11, path: 'right-inner', delay: 1.65, speed: 1.0, length: 8, thickness: 2.1, opacity: 0.95, grad: 'sparkGrad' },
      { id: 12, path: 'left-outer', delay: 1.9, speed: 1.25, length: 6, thickness: 1.8, opacity: 0.85, grad: 'sparkGrad' },

      // 2. MEDIUM ENERGY RODS (Moderate Velocity: 1.6s - 2.5s, lengths: 14 - 24px, thickness: 2.6 - 3.4px)
      { id: 13, path: 'left-inner', delay: 0.0, speed: 2.1, length: 22, thickness: 3.2, opacity: 0.95, grad: 'rodGrad' },
      { id: 14, path: 'right-inner', delay: 0.35, speed: 2.1, length: 24, thickness: 3.2, opacity: 0.95, grad: 'rodGrad' },
      { id: 15, path: 'center-stem', delay: 0.5, speed: 1.8, length: 20, thickness: 3.0, opacity: 0.95, grad: 'rodGrad' },
      { id: 16, path: 'left-outer', delay: 0.85, speed: 2.3, length: 18, thickness: 2.8, opacity: 0.85, grad: 'rodGrad' },
      { id: 17, path: 'right-outer', delay: 1.15, speed: 2.3, length: 18, thickness: 2.8, opacity: 0.85, grad: 'rodGrad' },
      { id: 18, path: 'left-far', delay: 1.35, speed: 2.4, length: 16, thickness: 2.5, opacity: 0.8, grad: 'rodGrad' },
      { id: 19, path: 'right-far', delay: 1.55, speed: 2.4, length: 16, thickness: 2.5, opacity: 0.8, grad: 'rodGrad' },
      { id: 20, path: 'left-inner', delay: 1.75, speed: 2.0, length: 20, thickness: 3.0, opacity: 0.9, grad: 'rodGrad' },
      { id: 21, path: 'right-inner', delay: 2.0, speed: 2.0, length: 20, thickness: 3.0, opacity: 0.9, grad: 'rodGrad' },
      { id: 22, path: 'center-stem', delay: 2.2, speed: 1.7, length: 22, thickness: 3.2, opacity: 0.95, grad: 'rodGrad' },
      { id: 23, path: 'left-outer', delay: 2.5, speed: 2.2, length: 19, thickness: 2.7, opacity: 0.85, grad: 'rodGrad' },
      { id: 24, path: 'right-outer', delay: 2.75, speed: 2.2, length: 19, thickness: 2.7, opacity: 0.85, grad: 'rodGrad' },

      // 3. SLOW POWER PULSES & HEAVY ENERGY SURGES (Low Velocity: 3.0s - 4.2s, long lengths: 28 - 38px, thickness: 3.4 - 4.2px)
      { id: 25, path: 'center-stem', delay: 0.2, speed: 3.4, length: 34, thickness: 3.8, opacity: 1, grad: 'slowGrad' },
      { id: 26, path: 'left-inner', delay: 0.6, speed: 3.6, length: 30, thickness: 3.5, opacity: 0.9, grad: 'slowGrad' },
      { id: 27, path: 'right-inner', delay: 1.0, speed: 3.6, length: 30, thickness: 3.5, opacity: 0.9, grad: 'slowGrad' },
      { id: 28, path: 'left-outer', delay: 1.5, speed: 3.8, length: 28, thickness: 3.2, opacity: 0.85, grad: 'slowGrad' },
      { id: 29, path: 'right-outer', delay: 1.8, speed: 3.8, length: 28, thickness: 3.2, opacity: 0.85, grad: 'slowGrad' },
      { id: 30, path: 'center-stem', delay: 2.4, speed: 3.2, length: 36, thickness: 4.0, opacity: 0.95, grad: 'slowGrad' },
      { id: 31, path: 'left-far', delay: 2.1, speed: 4.0, length: 26, thickness: 3.0, opacity: 0.75, grad: 'slowGrad' },
      { id: 32, path: 'right-far', delay: 2.6, speed: 4.0, length: 26, thickness: 3.0, opacity: 0.75, grad: 'slowGrad' },

      // 4. MICRO ENERGY DOTS & GLOWING EMITTED SPARKS (Small high/low velocity variety: 1.1s - 2.8s, tiny size: 3px)
      { id: 33, path: 'center-stem', delay: 1.0, speed: 1.3, length: 3.5, thickness: 2.4, opacity: 1, grad: 'sparkGrad' },
      { id: 34, path: 'left-inner', delay: 2.3, speed: 1.5, length: 4, thickness: 2.2, opacity: 0.95, grad: 'sparkGrad' },
      { id: 35, path: 'right-inner', delay: 2.7, speed: 1.4, length: 4, thickness: 2.2, opacity: 0.95, grad: 'sparkGrad' },
      { id: 36, path: 'center-stem', delay: 3.1, speed: 2.6, length: 5, thickness: 2.8, opacity: 0.9, grad: 'rodGrad' },
    ];
  }, []);

  // Calculate SVG strokeDashoffset for battery percentage ring
  // Circumference of r=130 is 2 * PI * 130 = ~816.81
  const ringRadius = 130;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  return (
    <AnimatePresence>
      {state === 'animating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black text-white pointer-events-auto overflow-hidden select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Close button shown strictly in preview mode */}
          {isPreview && onClose && (
            <motion.button
              id="charging-preview-close-button"
              onClick={onClose}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="absolute top-5 sm:top-7 right-5 sm:right-7 z-50 p-2.5 sm:p-3 rounded-full bg-neutral-900/90 border border-neutral-700/80 text-white/80 hover:text-white hover:bg-neutral-800 transition-all backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.7)] cursor-pointer flex items-center justify-center"
              aria-label="Close Charging Preview"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}

          {/* Top Notch-Like Charging/Charged Indicator Pill */}
          <div className="absolute top-5 sm:top-7 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
            <motion.div
              id="charging-top-notch"
              initial={{ y: -30, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.08 }}
              className="pointer-events-auto flex items-center justify-between gap-6 sm:gap-8 px-5 py-2 sm:px-6 sm:py-2.5 rounded-full bg-black/90 border border-neutral-700/80 shadow-[0_8px_30px_rgba(0,0,0,0.85)] select-none backdrop-blur-md min-w-[220px] max-w-[90vw]"
            >
              {/* Left label: Icon + Status text (Shows 'Charged' in preview mode, 'Charging' in real mode) */}
              <div className="flex items-center gap-1.5 text-white">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#30D158] fill-[#30D158]" />
                <span className="text-white font-semibold text-sm sm:text-base tracking-tight font-sans">
                  {isPreview ? 'Charged' : 'Charging'}
                </span>
              </div>

              {/* Right section: Percentage + Live Battery Level Icon */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <span className="text-[#30D158] font-semibold text-sm sm:text-base font-sans tracking-tight">
                  {displayPercentage}%
                </span>

                {/* iOS-Style Horizontal Battery Indicator */}
                <div className="relative flex items-center">
                  <div className="w-6 h-3 sm:w-7 sm:h-3.5 rounded-[4px] border-[1.5px] border-[#30D158] p-[1.5px] flex items-center bg-transparent">
                    <div
                      className="h-full bg-[#30D158] rounded-[1.5px] transition-all duration-300"
                      style={{ width: `${Math.max(6, Math.min(100, displayPercentage))}%` }}
                    />
                  </div>
                  {/* Positive pole / terminal nib */}
                  <div className="w-[2px] h-[5px] bg-[#30D158] rounded-r-[1px] -ml-[0.5px]" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Main Visual Canvas Container - Centered and filling full screen height */}
          <div className="relative w-full h-full max-w-[500px] flex flex-col items-center justify-center overflow-hidden">
            
            {/* Subtle, restrained background radial aura centered on the circle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
              <div 
                className="w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-[100px]" 
              />
            </div>

            {/* System SVG Canvas: Conduits, Rings, Flowing Particles reaching viewport bottom */}
            <svg
              viewBox="0 0 400 1000"
              className="w-full h-full absolute inset-0 z-10 pointer-events-none"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Clean Energy Gradient for Active Ring */}
                <linearGradient id="ringEnergyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F2FE" />
                  <stop offset="50%" stopColor="#00A8FF" />
                  <stop offset="100%" stopColor="#3B82F6" />
                </linearGradient>

                {/* Conduit Line Gradient (Fading from bottom edge to center circle) */}
                <linearGradient id="conduitGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0, 242, 254, 0.75)" />
                  <stop offset="50%" stopColor="rgba(0, 168, 255, 0.4)" />
                  <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" />
                </linearGradient>

                {/* Glowing Linear Gradient for Standard Energy Rod Particles */}
                <linearGradient id="rodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.2" />
                  <stop offset="40%" stopColor="#00E5FF" stopOpacity="0.8" />
                  <stop offset="85%" stopColor="#38BDF8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                </linearGradient>

                {/* Bright Spark Gradient for High-Velocity Particles */}
                <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#A5F3FC" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
                </linearGradient>

                {/* Deep Cyan-Blue Pulse Gradient for Slow-Velocity Surges */}
                <linearGradient id="slowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.1" />
                  <stop offset="35%" stopColor="#0284C7" stopOpacity="0.75" />
                  <stop offset="80%" stopColor="#00F2FE" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#E0F2FE" stopOpacity="1" />
                </linearGradient>

                {/* Particle Glow Filter */}
                <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Subtle Arc Glow Filter */}
                <filter id="subtleArcGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Defined Motion Paths starting from well past bottom edge (y=1400) -> Upwards into Central Circle (cy=500) */}
                {/* Center Stem Path */}
                <path
                  id="path-center-stem"
                  d="M 200,1400 L 200,630"
                  fill="none"
                />
                {/* Left Inner Conduit Path */}
                <path
                  id="path-left-inner"
                  d="M 194,1400 L 194,700 C 194,645 135,630 111,606 A 138,138 0 0,1 200,362"
                  fill="none"
                />
                {/* Right Inner Conduit Path */}
                <path
                  id="path-right-inner"
                  d="M 206,1400 L 206,700 C 206,645 265,630 289,606 A 138,138 0 0,0 200,362"
                  fill="none"
                />
                {/* Left Outer Conduit Path */}
                <path
                  id="path-left-outer"
                  d="M 184,1400 L 184,710 C 184,650 125,635 101,610 A 148,148 0 0,1 200,352"
                  fill="none"
                />
                {/* Right Outer Conduit Path */}
                <path
                  id="path-right-outer"
                  d="M 216,1400 L 216,710 C 216,650 275,635 299,610 A 148,148 0 0,0 200,352"
                  fill="none"
                />
                {/* Outermost Left Conduit Path */}
                <path
                  id="path-left-far"
                  d="M 174,1400 L 174,720 C 174,655 115,640 90,614 A 158,158 0 0,1 200,342"
                  fill="none"
                />
                {/* Outermost Right Conduit Path */}
                <path
                  id="path-right-far"
                  d="M 226,1400 L 226,720 C 226,655 285,640 310,614 A 158,158 0 0,0 200,342"
                  fill="none"
                />
              </defs>

              {/* 1. PHYSICAL CONDUIT LINES & PERFECT CONCENTRIC DASH RINGS (Extending to bottom of screen) */}
              <g opacity="0.65">
                {/* Outermost Concentric Dash Path (Radius 158) */}
                <path
                  d="M 174,1600 L 174,720 C 174,655 115,640 90,614 A 158,158 0 1,1 310,614 C 285,640 226,655 226,720 L 226,1600"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                {/* Outer Concentric Dash Path (Radius 148) */}
                <path
                  d="M 184,1600 L 184,710 C 184,650 125,635 101,610 A 148,148 0 1,1 299,610 C 275,635 216,650 216,710 L 216,1600"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.2"
                  strokeDasharray="5 5"
                />
                {/* Inner Solid Conduits (Radius 138, parallel to active ring) */}
                <path
                  d="M 194,1600 L 194,700 C 194,645 135,630 111,606 A 138,138 0 0,1 200,362"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.4"
                />
                <path
                  d="M 206,1600 L 206,700 C 206,645 265,630 289,606 A 138,138 0 0,0 200,362"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.4"
                />
                {/* Main Central Feeder Stem */}
                <path
                  d="M 200,1600 L 200,630"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="2"
                />
              </g>

              {/* 2. ACTIVE GLOWING ROD & SPARK PARTICLES WITH VARIABLE VELOCITIES */}
              {!prefersReducedMotion && (
                <g className="energy-rods">
                  {energyParticles.map((p) => (
                    <g key={p.id} opacity={p.opacity} filter="url(#particleGlow)">
                      <rect
                        x={-p.length / 2}
                        y={-p.thickness / 2}
                        width={p.length}
                        height={p.thickness}
                        rx={p.thickness / 2}
                        ry={p.thickness / 2}
                        fill={`url(#${p.grad || 'rodGrad'})`}
                      >
                        <animateMotion
                          dur={`${p.speed}s`}
                          repeatCount="indefinite"
                          begin={`${p.delay}s`}
                          rotate="auto"
                          keyPoints="0;1"
                          keyTimes="0;1"
                          calcMode="linear"
                        >
                          <mpath href={`#path-${p.path}`} />
                        </animateMotion>
                      </rect>
                    </g>
                  ))}
                </g>
              )}

              {/* 3. CHARGING INDICATOR RINGS (Center: cx=200, cy=500) */}
              <g className="central-indicator-ring">
                {/* Outer Static Track Ring */}
                <circle
                  cx="200"
                  cy="500"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="5"
                />

                {/* Subdued Glow Background Arc */}
                <circle
                  cx="200"
                  cy="500"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#ringEnergyGrad)"
                  strokeWidth="10"
                  opacity="0.25"
                  filter="url(#subtleArcGlow)"
                  transform="rotate(-90 200 500)"
                />

                {/* Main Dynamic Battery Progress Ring Arc */}
                <motion.circle
                  cx="200"
                  cy="500"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#ringEnergyGrad)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  transform="rotate(-90 200 500)"
                  filter="url(#subtleArcGlow)"
                />

                {/* Inner Precision Hairline Rim */}
                <circle
                  cx="200"
                  cy="500"
                  r={ringRadius - 14}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1"
                />
              </g>
            </svg>

            {/* 4. CENTRAL TYPOGRAPHY - PERFECTLY OPTICALLY CENTERED INSIDE THE RING */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-0.5 z-20 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              
              {/* Large Clean Battery Percentage Number */}
              <div className="flex items-start justify-center select-none font-sans relative">
                <span
                  className="text-white font-extralight leading-[0.9] tracking-tight drop-shadow-[0_2px_16px_rgba(0,242,254,0.2)]"
                  style={{
                    fontSize: '92px',
                    letterSpacing: '-0.04em',
                    fontFamily: 'system-ui, -apple-system, SF Pro Display, sans-serif'
                  }}
                >
                  {displayPercentage}
                </span>
                <span
                  className="text-cyan-300/85 font-light ml-1.5 mt-1"
                  style={{
                    fontSize: '28px',
                    lineHeight: '1',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  %
                </span>
              </div>

              {/* Secondary Status Label: CHARGED in preview mode, CHARGING in real mode */}
              <div className="mt-2 flex items-center justify-center">
                <span className="text-[12px] font-semibold tracking-[0.28em] text-cyan-300/90 uppercase font-sans">
                  {isPreview ? 'Charged' : 'Charging'}
                </span>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* Dimmed Clean Low-Power Screen Saver */}
      {state === 'black-screen' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center pointer-events-auto select-none"
          style={{ touchAction: 'none' }}
        >
          {isPreview && onClose && (
            <motion.button
              id="charging-preview-blackscreen-close-button"
              onClick={onClose}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              className="absolute top-5 sm:top-7 right-5 sm:right-7 z-50 p-2.5 sm:p-3 rounded-full bg-neutral-900/90 border border-neutral-700/80 text-white/80 hover:text-white hover:bg-neutral-800 transition-all backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.7)] cursor-pointer flex items-center justify-center"
              aria-label="Close Charging Preview"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </motion.button>
          )}
          <div className="flex flex-col items-center justify-center">
            {batteryLevel !== null && (
              <div className="flex items-baseline justify-center mb-5">
                <span className="text-cyan-400/60 font-sans font-extralight text-7xl tracking-tight opacity-50">
                  {Math.round(batteryLevel * 100)}
                </span>
                <span className="text-cyan-400/40 font-sans font-light text-2xl ml-1 opacity-50">%</span>
              </div>
            )}
            <p className="text-neutral-500 text-xs font-medium text-center px-6 max-w-xs leading-relaxed tracking-wide">
              Please don't use the application while charging.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChargingOverlay;

