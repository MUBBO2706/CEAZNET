import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Status } from '../hooks/useLiveConversation';

interface FluidMaskProps {
    audioLevel: number;
    status: Status;
}

const fragmentShader = `
  varying vec2 vUv;
  uniform float u_time;
  uniform float u_intensity;

  void main() {
    vec2 uv = vUv;
    float time = u_time * 0.05; // Slower time for more subtlety
    // Increased audio reactivity
    float audio = u_intensity * 4.0;

    // Slower, wider sine waves for a more subtle fluid motion
    float wave1 = sin(uv.x * 3.0 + time * 0.6) * 0.5 + 0.5;
    float wave2 = sin(uv.x * 7.0 - time * 0.4) * 0.5 + 0.5;
    float combined_waves = (wave1 * 0.7 + wave2 * 0.3);

    // The main vertical fade. pow makes the fade-off more gradual.
    float y_fade = pow(1.0 - uv.y, 3.0); // Increased exponent for more fade

    // Reduce the overall "rise and fall" effect to prevent the whole mask moving up.
    float rise_and_fall = audio * 0.05;
    
    // Modulate the surface with waves. Reduced base amplitude for less intensity.
    float wave_modulation = (combined_waves * 0.05 * (1.0 + audio * 1.5));

    // Combine all factors to get the final value for the mask.
    float final_mask_value = y_fade + rise_and_fall - wave_modulation;

    // Use smoothstep to create the soft, non-sharp edge.
    // A higher starting point and larger range makes the fade softer and lower.
    float alpha = smoothstep(0.1, 0.8, final_mask_value);
    
    // Add a more prominent glow near the top of the wave.
    float glow_factor = pow(smoothstep(0.4, 0.7, final_mask_value), 2.0);
    // Cut off the glow higher up to keep it near the "surface".
    glow_factor *= (1.0 - smoothstep(0.65, 0.8, final_mask_value));

    // Color scheme
    vec3 base_color = vec3(0.1, 0.3, 0.7); // Mid-blue
    vec3 glow_color = vec3(0.6, 0.8, 1.0); // Brighter blue for glow

    // Combine base color and glow, with more reactivity for the glow.
    vec3 final_color = mix(base_color, glow_color, glow_factor * (0.4 + audio * 1.0));
    
    gl_FragColor = vec4(final_color, alpha);
  }
`;

const FluidMask: React.FC<FluidMaskProps> = ({ audioLevel, status }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const uniformsRef = useRef({
        u_time: { value: 0 },
        u_intensity: { value: 0.1 },
    });
    const animationFrameIdRef = useRef<number | null>(null);
    const audioLevelRef = useRef(audioLevel);
    const statusRef = useRef(status);

    useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);
    useEffect(() => { statusRef.current = status; }, [status]);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        currentMount.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            uniforms: uniformsRef.current,
            vertexShader: `
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader,
            transparent: true,
        });

        const plane = new THREE.Mesh(geometry, material);
        scene.add(plane);

        const clock = new THREE.Clock();
        let smoothedIntensity = 0.1;

        const animate = () => {
            animationFrameIdRef.current = requestAnimationFrame(animate);
            
            const currentStatus = statusRef.current;
            const currentAudioLevel = audioLevelRef.current;

            const isActive = currentStatus === 'listening' || currentStatus === 'speaking';
            const targetIntensity = isActive ? 0.2 + currentAudioLevel * 2.5 : 0.1;
            smoothedIntensity += (targetIntensity - smoothedIntensity) * 0.05;

            uniformsRef.current.u_time.value = clock.getElapsedTime();
            uniformsRef.current.u_intensity.value = smoothedIntensity;

            renderer.render(scene, camera);
        };

        const resizeObserver = new ResizeObserver(entries => {
            if (!Array.isArray(entries) || !entries.length) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            renderer.setSize(width, height);
        });

        resizeObserver.observe(currentMount);
        animate();

        return () => {
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            resizeObserver.disconnect();
            if (currentMount && renderer.domElement) {
                currentMount.removeChild(renderer.domElement);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={mountRef} className="absolute bottom-0 left-0 w-full h-[60%] pointer-events-none" />;
};

export default FluidMask;
