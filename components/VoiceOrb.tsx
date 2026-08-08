import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Status } from '../hooks/useLiveConversation';

interface VoiceOrbProps {
    audioLevel: number;
    status: Status;
}

// Simplex noise function included in the shader
const vertexShader = `
    uniform float u_time;
    uniform float u_frequency;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDisplacement;
    varying vec3 vPosition;

    // Simplex 3D Noise 
    vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
        const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
        const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

        // First corner
        vec3 i  = floor(v + dot(v, C.yyy) );
        vec3 x0 = v - i + dot(i, C.xxx) ;

        // Other corners
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min( g.xyz, l.zxy );
        vec3 i2 = max( g.xyz, l.zxy );

        //  x0 = x0 - 0.0 + 0.0 * C 
        vec3 x1 = x0 - i1 + 1.0 * C.xxx;
        vec3 x2 = x0 - i2 + 2.0 * C.xxx;
        vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

        // Permutations
        i = mod(i, 289.0 ); 
        vec4 p = permute( permute( permute( 
                    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

        // Gradients
        // ( N*N points uniformly over a square, mapped onto an octahedron.)
        float n_ = 0.142857142857; // 1.0/7.0
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,N*N)

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4( x.xy, y.xy );
        vec4 b1 = vec4( x.zw, y.zw );

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

        vec3 p0 = vec3(a0.xy,h.x);
        vec3 p1 = vec3(a0.zw,h.y);
        vec3 p2 = vec3(a1.xy,h.z);
        vec3 p3 = vec3(a1.zw,h.w);

        //Normalise gradients
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        // Mix final noise value
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                      dot(p2,x2), dot(p3,x3) ) );
    }

    void main() {
        vUv = uv;
        vNormal = normal;
        vPosition = position;
        
        // Layered noise for organic feel
        float noise1 = snoise(position * 0.8 + u_time * 0.15);
        float noise2 = snoise(position * 2.5 - u_time * 0.3);
        
        // Audio reactivity affects displacement intensity - INCREASED SENSITIVITY
        float audioFactor = 0.1 + u_frequency * 3.0;
        
        // Combine noise layers
        float displacement = (noise1 * 0.6 + noise2 * 0.4) * audioFactor;
        
        vDisplacement = displacement;
        
        // Displace vertex along normal + slight overall expansion on beat
        vec3 newPosition = position + normal * displacement + (normal * u_frequency * 0.5);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
`;

const fragmentShader = `
    uniform float u_time;
    uniform float u_frequency;
    uniform vec3 u_color1;
    uniform vec3 u_color2;
    uniform vec3 u_color3;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    varying float vDisplacement;
    varying vec3 vPosition;
    
    void main() {
        // Create a soft, ethereal gradient
        // Mix colors based on displacement and position
        
        float mixFactor = smoothstep(-0.5, 0.5, vDisplacement);
        
        vec3 colorA = mix(u_color1, u_color2, mixFactor);
        vec3 finalColor = mix(colorA, u_color3, sin(vPosition.y + u_time * 0.2) * 0.5 + 0.5);
        
        // Add "inner glow" based on audio - clamped to prevent washout
        // Use u_color2 (Teal) for the glow instead of white to preserve color richness
        float freqEffect = clamp(u_frequency, 0.0, 1.2);
        finalColor += u_color2 * freqEffect * 0.6;
        
        // Fresnel effect for rim lighting (soft edges)
        vec3 viewDir = normalize(cameraPosition - vPosition); // Approx view dir
        
        float fresnel = pow(1.0 - dot(viewDir, vNormal), 3.0);
        
        // Add fresnel glow - reduced intensity and tinted blue instead of pure white
        finalColor += vec3(0.2, 0.4, 0.8) * fresnel * 0.4;
        
        // Soft alpha for edges
        float alpha = 0.8 + fresnel * 0.2;
        
        // Clamp final color to prevent it from going > 1.0 which might look purely white in some tone mappings
        gl_FragColor = vec4(min(finalColor, vec3(1.0)), alpha);
    }
`;

const VoiceOrb: React.FC<VoiceOrbProps> = ({ audioLevel, status }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const uniformsRef = useRef<any>(null);
    
    const audioLevelRef = useRef(audioLevel);
    const statusRef = useRef(status);

    useEffect(() => { audioLevelRef.current = audioLevel; }, [audioLevel]);
    useEffect(() => { statusRef.current = status; }, [status]);

    useEffect(() => {
        const currentMount = mountRef.current;
        if (!currentMount) return;

        // Scene setup
        const scene = new THREE.Scene();
        
        // Camera setup
        const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.z = 2.8;
        
        // Renderer setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        currentMount.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Define uniforms
        const uniforms = {
            u_time: { value: 0.0 },
            u_frequency: { value: 0.0 },
            // Relaxing palette: Deep Ocean / Aurora
            u_color1: { value: new THREE.Color(0.1, 0.05, 0.3) }, // Deep Purple/Blue
            u_color2: { value: new THREE.Color(0.0, 0.5, 0.6) },  // Teal
            u_color3: { value: new THREE.Color(0.6, 0.2, 0.8) }   // Soft Violet
        };
        uniformsRef.current = uniforms;
        
        // Create Geometry (High detail sphere for fluid movement)
        // REDUCED SIZE: Radius 1.2 -> 1.0
        const geometry = new THREE.IcosahedronGeometry(1.0, 30); 
        
        const material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending, // Glowy look
            depthWrite: false // Disable depth write for transparency sorting
        });
        
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);
        
        const clock = new THREE.Clock();

        const animate = () => {
            animationFrameIdRef.current = requestAnimationFrame(animate);
            
            const elapsedTime = clock.getElapsedTime();
            uniforms.u_time.value = elapsedTime;

            const isActive = statusRef.current === 'listening' || statusRef.current === 'speaking';
            const currentAudioLevel = audioLevelRef.current;
            
            // Audio reactivity smoothing
            if (isActive) {
                const targetFreq = currentAudioLevel; 
                // Increased reactivity speed slightly
                uniforms.u_frequency.value += (targetFreq - uniforms.u_frequency.value) * 0.2; 
            } else {
                uniforms.u_frequency.value *= 0.9; // Faster decay
            }
            
            // Very slow, relaxing rotation
            sphere.rotation.y = elapsedTime * 0.05;
            sphere.rotation.z = elapsedTime * 0.02;
            
            renderer.render(scene, camera);
        };
        
        animate();

        const resizeObserver = new ResizeObserver(entries => {
            if (!Array.isArray(entries) || !entries.length) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        resizeObserver.observe(currentMount);

        return () => {
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            resizeObserver.disconnect();
            if (currentMount && renderer.domElement) {
                currentMount.removeChild(renderer.domElement);
            }
            geometry.dispose();
            material.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div 
            ref={mountRef} 
            // Shifted down to 45%
            className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[400px] max-h-[400px] z-10 pointer-events-none"
        />
    );
};

export default VoiceOrb;