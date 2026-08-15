import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'motion/react';
import { ChargingOverlayState } from '../hooks/useChargingMode';
import { updateBrowserThemeColor } from '../utils/themeColor';

interface ChargingOverlayProps {
  state: ChargingOverlayState;
  batteryLevel: number | null;
}

const ChargingOverlay: React.FC<ChargingOverlayProps> = ({ state, batteryLevel }) => {
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

  // Streamlined Glowing Rod Particles moving along the conduits from bottom to circle
  const energyParticles = useMemo(() => {
    return [
      { id: 1, path: 'left-inner', delay: 0, speed: 2.2, length: 22, thickness: 3.2, opacity: 0.95 },
      { id: 2, path: 'right-inner', delay: 0.35, speed: 2.2, length: 24, thickness: 3.2, opacity: 0.95 },
      { id: 3, path: 'center-stem', delay: 0.7, speed: 1.8, length: 28, thickness: 3.6, opacity: 1 },
      { id: 4, path: 'left-outer', delay: 1.0, speed: 2.4, length: 18, thickness: 2.8, opacity: 0.85 },
      { id: 5, path: 'right-outer', delay: 1.3, speed: 2.4, length: 18, thickness: 2.8, opacity: 0.85 },
      { id: 6, path: 'left-inner', delay: 1.6, speed: 2.0, length: 22, thickness: 3.0, opacity: 0.9 },
      { id: 7, path: 'right-inner', delay: 1.9, speed: 2.0, length: 22, thickness: 3.0, opacity: 0.9 },
      { id: 8, path: 'center-stem', delay: 1.4, speed: 1.7, length: 26, thickness: 3.4, opacity: 0.95 },
      { id: 9, path: 'left-outer', delay: 2.1, speed: 2.3, length: 20, thickness: 2.6, opacity: 0.8 },
      { id: 10, path: 'right-outer', delay: 2.4, speed: 2.3, length: 20, thickness: 2.6, opacity: 0.8 },
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
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black text-white pointer-events-auto overflow-hidden select-none"
          style={{ touchAction: 'none' }}
        >
          {/* Top Notch-Like Charging Indicator Pill (as requested in reference image) */}
          <div className="absolute top-5 sm:top-7 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
            <motion.div
              id="charging-top-notch"
              initial={{ y: -30, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.08 }}
              className="pointer-events-auto flex items-center justify-between gap-6 sm:gap-8 px-5 py-2 sm:px-6 sm:py-2.5 rounded-full bg-black/90 border border-neutral-700/80 shadow-[0_8px_30px_rgba(0,0,0,0.85)] select-none backdrop-blur-md min-w-[220px] max-w-[90vw]"
            >
              {/* Left label: Charging in crisp white */}
              <span className="text-white font-semibold text-sm sm:text-base tracking-tight font-sans">
                Charging
              </span>

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

          {/* Main Visual Canvas Container - Centered */}
          <div className="relative w-full max-w-[440px] h-full max-h-[860px] flex flex-col items-center justify-center">
            
            {/* Subtle, restrained background radial aura centered on the circle */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
              <div 
                className="w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-[100px]" 
              />
            </div>

            {/* System SVG Canvas: Conduits, Rings, Flowing Particles */}
            <svg
              viewBox="0 0 400 800"
              className="w-full h-full max-h-[800px] absolute inset-0 z-10 pointer-events-none"
              preserveAspectRatio="xMidYMid meet"
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

                {/* Glowing Linear Gradient for Energy Rod Particles */}
                <linearGradient id="rodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.2" />
                  <stop offset="40%" stopColor="#00E5FF" stopOpacity="0.8" />
                  <stop offset="85%" stopColor="#38BDF8" stopOpacity="1" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
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

                {/* Defined Motion Paths starting from very bottom edge (y=800) -> Upwards into Central Circle (cy=400) */}
                {/* Center Stem Path */}
                <path
                  id="path-center-stem"
                  d="M 200,800 L 200,530"
                  fill="none"
                />
                {/* Left Inner Conduit Path */}
                <path
                  id="path-left-inner"
                  d="M 194,800 L 194,600 C 194,545 135,530 111,506 A 138,138 0 0,1 200,262"
                  fill="none"
                />
                {/* Right Inner Conduit Path */}
                <path
                  id="path-right-inner"
                  d="M 206,800 L 206,600 C 206,545 265,530 289,506 A 138,138 0 0,0 200,262"
                  fill="none"
                />
                {/* Left Outer Conduit Path */}
                <path
                  id="path-left-outer"
                  d="M 184,800 L 184,610 C 184,550 125,535 101,510 A 148,148 0 0,1 200,252"
                  fill="none"
                />
                {/* Right Outer Conduit Path */}
                <path
                  id="path-right-outer"
                  d="M 216,800 L 216,610 C 216,550 275,535 299,510 A 148,148 0 0,0 200,252"
                  fill="none"
                />
              </defs>

              {/* 1. PHYSICAL CONDUIT LINES & PERFECT CONCENTRIC DASH RINGS (Parallel to circle, curving at bottom) */}
              <g opacity="0.65">
                {/* Outermost Concentric Dash Path (Radius 158, perfectly parallel all around top and sides) */}
                <path
                  d="M 174,800 L 174,620 C 174,555 115,540 90,514 A 158,158 0 1,1 310,514 C 285,540 226,555 226,620 L 226,800"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
                {/* Outer Concentric Dash Path (Radius 148, perfectly parallel) */}
                <path
                  d="M 184,800 L 184,610 C 184,550 125,535 101,510 A 148,148 0 1,1 299,510 C 275,535 216,550 216,610 L 216,800"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.2"
                  strokeDasharray="5 5"
                />
                {/* Inner Solid Conduits (Radius 138, parallel to active ring) */}
                <path
                  d="M 194,800 L 194,600 C 194,545 135,530 111,506 A 138,138 0 0,1 200,262"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.4"
                />
                <path
                  d="M 206,800 L 206,600 C 206,545 265,530 289,506 A 138,138 0 0,0 200,262"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="1.4"
                />
                {/* Main Central Feeder Stem */}
                <path
                  d="M 200,800 L 200,530"
                  fill="none"
                  stroke="url(#conduitGrad)"
                  strokeWidth="2"
                />
              </g>

              {/* 2. ACTIVE GLOWING ROD-LIKE ENERGY PARTICLES TRAVELLING FROM BOTTOM EDGE UP TO CIRCLE */}
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
                        fill="url(#rodGrad)"
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

              {/* 3. ENLARGED & VERTICALLY CENTERED CHARGING INDICATOR RINGS (Center: cx=200, cy=400) */}
              <g className="central-indicator-ring">
                {/* Outer Static Track Ring */}
                <circle
                  cx="200"
                  cy="400"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="5"
                />

                {/* Subdued Glow Background Arc */}
                <circle
                  cx="200"
                  cy="400"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#ringEnergyGrad)"
                  strokeWidth="10"
                  opacity="0.25"
                  filter="url(#subtleArcGlow)"
                  transform="rotate(-90 200 400)"
                />

                {/* Main Dynamic Battery Progress Ring Arc */}
                <motion.circle
                  cx="200"
                  cy="400"
                  r={ringRadius}
                  fill="none"
                  stroke="url(#ringEnergyGrad)"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  transform="rotate(-90 200 400)"
                  filter="url(#subtleArcGlow)"
                />

                {/* Inner Precision Hairline Rim */}
                <circle
                  cx="200"
                  cy="400"
                  r={ringRadius - 14}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="1"
                />
              </g>
            </svg>

            {/* 4. CENTRAL TYPOGRAPHY - 100% VERTICALLY & HORIZONTALLY CENTERED (No icon) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              
              {/* Large Clean Battery Percentage Number */}
              <div className="flex items-baseline justify-center select-none font-sans">
                <span
                  className="text-white font-extralight leading-none tracking-tight drop-shadow-[0_2px_16px_rgba(0,242,254,0.2)]"
                  style={{
                    fontSize: '94px',
                    letterSpacing: '-0.04em',
                    fontFamily: 'system-ui, -apple-system, SF Pro Display, sans-serif'
                  }}
                >
                  {displayPercentage}
                </span>
                <span
                  className="text-cyan-300/80 font-light ml-1.5"
                  style={{
                    fontSize: '30px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                >
                  %
                </span>
              </div>

              {/* Secondary Status Label: CHARGING (Centered underneath number, no icon) */}
              <div className="mt-2.5 flex items-center justify-center">
                <span className="text-[12px] font-semibold tracking-[0.28em] text-cyan-300/90 uppercase font-sans">
                  Charging
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
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center pointer-events-auto select-none"
          style={{ touchAction: 'none' }}
        >
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
