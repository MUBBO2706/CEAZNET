import React from 'react';
import { Status } from '../hooks/useLiveConversation';

interface BarVisualizerProps {
  audioLevel: number;
  status: Status;
}

const NUM_BARS = 32;

const BarVisualizer: React.FC<BarVisualizerProps> = ({ audioLevel, status }) => {
  const bars = Array.from({ length: NUM_BARS });
  const isActive = status === 'listening' || status === 'speaking';
  const time = isActive ? Date.now() / 200 : 0;

  // Colors based on the user-provided image
  const centerColor = { r: 255, g: 220, b: 0 }; // Bright Yellow
  const edgeColor = { r: 239, g: 68, b: 68 }; // Red-500
  const idleColor = { r: 107, g: 114, b: 128 }; // Gray-500

  // Helper to interpolate between two colors
  const lerpColor = (color1: { r: number, g: number, b: number }, color2: { r: number, g: number, b: number }, factor: number) => {
    const r = color1.r + factor * (color2.r - color1.r);
    const g = color1.g + factor * (color2.g - color1.g);
    const b = color1.b + factor * (color2.b - color1.b);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  };

  return (
    <div className="flex justify-center items-center gap-1.5 h-16 w-64" aria-hidden="true">
      {bars.map((_, i) => {
        // Create a symmetric "diamond" shape using a window function
        const center = (NUM_BARS - 1) / 2;
        const distanceFromCenter = Math.abs(i - center);
        const windowFactor = Math.max(0, 1 - distanceFromCenter / center); // Linear window for a sharp diamond

        // A sine wave that travels across the bars for dynamic movement
        const sinValue = Math.sin(distanceFromCenter * 0.5 - time * 2);

        // A slower, gentle wave for the idle/disconnected state
        const idleHeight = (Math.sin(i * 0.2 + Date.now() / 500) * 0.5 + 0.5) * 10 + 4;

        // A more dynamic wave that reacts to audio level for the active state
        const activeHeight = Math.max(
          4, // Minimum height
          (windowFactor * 60) * (audioLevel * 1.5 + 0.2) + (sinValue * 5 * audioLevel)
        );

        const heightInPixels = isActive ? activeHeight : idleHeight;

        // Determine color based on position (distance from center)
        const colorFactor = distanceFromCenter / center;
        const color = isActive ? lerpColor(centerColor, edgeColor, colorFactor) : `rgb(${idleColor.r}, ${idleColor.g}, ${idleColor.b})`;
        
        return (
          <div
            key={i}
            className="w-1.5 rounded-full transition-all duration-100 ease-out"
            style={{
              height: `${heightInPixels}px`,
              backgroundColor: color,
              boxShadow: isActive ? `0 0 2px ${color}, 0 0 4px ${color}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

export default BarVisualizer;