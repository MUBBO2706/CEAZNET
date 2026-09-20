import React from 'react';

interface TextShimmerProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({
  children,
  className = '',
  duration = 2,
}) => {
  return (
    <>
      <style>{`
        @keyframes shimmer-text-anim {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .text-shimmer-effect {
          background-image: linear-gradient(
            110deg,
            #6b7280 35%,
            #f9fafb 50%,
            #6b7280 65%
          );
          background-size: 200% 100%;
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          animation: shimmer-text-anim ${duration}s linear infinite;
        }
        .dark .text-shimmer-effect {
          background-image: linear-gradient(
            110deg,
            #d1d5db 35%,
            #ffffff 50%,
            #d1d5db 65%
          );
        }
      `}</style>
      <div className={`text-shimmer-effect ${className}`}>
        {children}
      </div>
    </>
  );
};
