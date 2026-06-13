import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MoleculeData, MoleculeViewerState } from '../types';
import Tooltip from './Tooltip';
import { Atom, Maximize, ChevronDown } from 'lucide-react';

// Add ExpandableText component outside MoleculeViewer
const ExpandableText = ({ text, label }: { text: string, label: string }) => {
    const [expanded, setExpanded] = useState(false);
    const isLong = text && text.length > 30;
    
    return (
        <div className="group relative">
            <div className="flex items-center justify-between mb-0.5">
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase">{label}</p>
                {isLong && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} 
                        className="text-[10px] text-amber-500 hover:text-amber-600 flex items-center gap-0.5"
                    >
                        {expanded ? 'Less' : 'More'}
                        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            <div className={`p-1.5 bg-neutral-50 dark:bg-white/5 rounded font-mono text-[9px] text-neutral-600 dark:text-neutral-300 select-all w-fit max-w-full ${expanded ? 'break-all' : 'truncate'}`}>
                {text || 'N/A'}
            </div>
        </div>
    );
};

// CPK colors for atoms
const atomColors: Record<string, number> = {
    H: 0xffffff,  // White
    C: 0x333333,  // Dark Grey
    N: 0x0000ff,  // Blue
    O: 0xff0000,  // Red
    F: 0x00ff00,  // Green
    CL: 0x00ff00, // Green
    BR: 0xa52a2a, // Brown
    I: 0x9400d3,  // Violet
    S: 0xffff00,  // Yellow
    P: 0xffa500,  // Orange
    B: 0xffc0cb,  // Pink
    SI: 0xdaa520, // Goldenrod
    DEFAULT: 0xcccccc, // Gray
};

const atomRadii: Record<string, number> = {
    H: 0.3, C: 0.7, N: 0.65, O: 0.6, F: 0.5,
    CL: 1.0, BR: 1.15, I: 1.35, S: 1.0, P: 1.0,
    DEFAULT: 0.6,
};

const vdwRadii: Record<string, number> = {
    H: 1.1, C: 1.7, N: 1.55, O: 1.52, F: 1.47,
    CL: 1.75, BR: 1.85, I: 1.98, S: 1.8, P: 1.8,
    DEFAULT: 1.5,
};

const valenceElectrons: Record<string, number> = {
    H: 1, C: 4, N: 5, O: 6, F: 7,
    CL: 7, BR: 7, I: 7, S: 6, P: 5,
    B: 3, SI: 4, DEFAULT: 0,
};

type MoleculeStyle = 'ballAndStick' | 'sticks' | 'wireframe' | 'spaceFilling';

// Cache for label textures to avoid re-creating canvases
const textureCache = new Map<string, THREE.Texture>();

let electronTextureCache: THREE.CanvasTexture | null = null;
const getElectronTexture = (): THREE.Texture => {
    if (electronTextureCache) return electronTextureCache;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');      // Hot white core
        gradient.addColorStop(0.15, 'rgba(0, 255, 255, 0.8)');   // Bright cyan inner glow
        gradient.addColorStop(0.4, 'rgba(0, 150, 255, 0.2)');    // Blue outer glow
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');            // Fade
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    electronTextureCache = texture;
    return texture;
};

const getLabelTexture = (text: string, atomHexColor: number): THREE.Texture | null => {
    // Cache key now includes color to differentiate contrasting labels
    const cacheKey = `label-${text}-${atomHexColor}`;
    if (textureCache.has(cacheKey)) {
        return textureCache.get(cacheKey)!;
    }

    // Calculate brightness of the atom color
    const r = (atomHexColor >> 16) & 255;
    const g = (atomHexColor >> 8) & 255;
    const b = atomHexColor & 255;
    // Standard luminance formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Threshold: > 128 is generally considered "light", but 150 is safer for clear readability
    const isLightBackground = brightness > 150;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    const fontSize = 100;
    const padding = 20;
    
    const fontStyle = `bold ${fontSize}px "Geist Sans", sans-serif`;
    context.font = fontStyle;
    
    const textMetrics = context.measureText(text);
    canvas.width = textMetrics.width + padding * 4;
    canvas.height = fontSize * 1.6;

    context.font = fontStyle;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Dynamic Contrast Logic:
    // If background is light (Hydrogen) -> Crisp Black Text, NO stroke.
    // If background is dark (Carbon) -> White Text, Thin Black Stroke for readability.
    if (isLightBackground) {
        context.fillStyle = '#000000';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
    } else {
        context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        context.lineWidth = 8;
        context.lineJoin = 'round';
        context.strokeText(text, canvas.width / 2, canvas.height / 2);
        
        context.fillStyle = '#ffffff';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    
    textureCache.set(cacheKey, texture);
    return texture;
};

// Remove local interface definition to use central types
interface MoleculeViewerProps {
    molecule: MoleculeData;
    onMaximize?: () => void;
    isFullScreen?: boolean;
    externalState?: MoleculeViewerState;
    onExternalStateChange?: (newState: Partial<MoleculeViewerState>) => void;
    hideControls?: boolean;
    transparent?: boolean;
}

// Reuse geometries and materials
const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12);
const atomMaterial = new THREE.MeshPhysicalMaterial({ 
    roughness: 0.2, 
    metalness: 0.1, 
    clearcoat: 0.8,
    clearcoatRoughness: 0.1 
});
const bondMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888, 
    roughness: 0.4, 
    metalness: 0.3 
});

const StyleRadioButton: React.FC<{ id: string; label: string; value: MoleculeStyle; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; isOverlay?: boolean; }> = ({ id, label, value, checked, onChange, isOverlay }) => (
    <div className="flex items-center">
        <input type="radio" id={id} name="molecule-style" value={value} checked={checked} onChange={onChange} className="sr-only" />
        <label htmlFor={id} className={`px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors ${checked ? 'bg-amber-500 text-white shadow-sm' : isOverlay ? 'bg-black/20 dark:bg-white/10 text-neutral-800 dark:text-gray-200 hover:bg-black/30 dark:hover:bg-white/20' : 'bg-neutral-200 dark:bg-gray-700/60 text-neutral-600 dark:text-gray-300 hover:bg-neutral-300 dark:hover:bg-gray-600'}`}>{label}</label>
    </div>
);

const CustomCheckbox: React.FC<{ id: string; label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; isOverlay?: boolean; }> = ({ id, label, checked, onChange, isOverlay }) => (
    <div className="flex items-center">
        <input type="checkbox" id={id} checked={checked} onChange={onChange} className="sr-only" />
        <label htmlFor={id} className={`flex items-center gap-2 text-sm font-medium cursor-pointer ${isOverlay ? 'text-neutral-700 dark:text-gray-200' : 'text-neutral-600 dark:text-gray-300'}`}>
            <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${checked ? 'bg-amber-500 border-amber-500' : `bg-transparent ${isOverlay ? 'border-neutral-200 dark:border-gray-300' : 'border-neutral-400 dark:border-gray-500'}`}`}>
                {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            {label}
        </label>
    </div>
);

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ 
    molecule, 
    onMaximize, 
    isFullScreen = false,
    externalState,
    onExternalStateChange,
    hideControls = false,
    transparent = false
}) => {
    const mountRef = useRef<HTMLDivElement>(null);
    
    // Internal state
    const [internalState, setInternalState] = useState<MoleculeViewerState>({
        showElectrons: false,
        showElectronCloud: false,
        style: 'ballAndStick',
        showHydrogens: true,
        showLabels: true,
        autoRotate: false
    });

    // Derived state (use external if available, else internal)
    const state = externalState || internalState;
    const { showElectrons, showElectronCloud, style, showHydrogens, showLabels, autoRotate } = state;

    // Helper to update state
    const updateState = (updates: Partial<MoleculeViewerState>) => {
        if (onExternalStateChange) {
            onExternalStateChange(updates);
        } else {
            setInternalState(prev => ({ ...prev, ...updates }));
        }
    };

    const [isControlsOpen, setIsControlsOpen] = useState(false);
    
    // Shared reusable objects to reduce GC
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const _color = useMemo(() => new THREE.Color(), []);
    const _vec3 = useMemo(() => new THREE.Vector3(), []);
    const _cameraDir = useMemo(() => new THREE.Vector3(), []); // For label direction
    const autoRotateRef = useRef(autoRotate);

    // Keep track of labels to update their position in the animation loop
    const labelsRef = useRef<{ sprite: THREE.Sprite, atomIndex: number, radius: number }[]>([]);

    useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

    const filteredMolecule = useMemo(() => {
        if (showHydrogens) return molecule;
        const nonHydrogenAtoms = molecule.atoms.map((atom, index) => ({ ...atom, originalIndex: index })).filter(atom => atom.element.toUpperCase() !== 'H');
        const oldToNewIndexMap = new Map<number, number>();
        nonHydrogenAtoms.forEach((atom, newIndex) => oldToNewIndexMap.set(atom.originalIndex, newIndex));
        const filteredBonds = molecule.bonds.filter(bond => oldToNewIndexMap.has(bond.from) && oldToNewIndexMap.has(bond.to)).map(bond => ({ ...bond, from: oldToNewIndexMap.get(bond.from)!, to: oldToNewIndexMap.get(bond.to)! }));
        return { ...molecule, atoms: nonHydrogenAtoms, bonds: filteredBonds };
    }, [molecule, showHydrogens]);

    useEffect(() => {
        if (!mountRef.current || !filteredMolecule) return;
        const currentMount = mountRef.current;
        
        while(currentMount.firstChild) currentMount.removeChild(currentMount.firstChild);

        const scene = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        // Optimize: Use lower pixel ratio for preview/card views (hideControls=true) to reduce lag
        renderer.setPixelRatio(hideControls ? 1 : Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        currentMount.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(45, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        camera.position.z = 14;
        
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 7);
        scene.add(dirLight);
        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-5, -5, -10);
        scene.add(backLight);

        const moleculeGroup = new THREE.Group();
        const positions = filteredMolecule.atoms.map(atom => new THREE.Vector3(atom.x, atom.y, atom.z));
        
        // Center molecule
        const center = new THREE.Vector3();
        if (positions.length > 0) {
            positions.forEach(p => center.add(p));
            center.divideScalar(positions.length);
            moleculeGroup.position.sub(center);
        }

        // --- ATOMS (InstancedMesh) ---
        if (style !== 'sticks' && style !== 'wireframe') {
            const atomCount = filteredMolecule.atoms.length;
            const atomMesh = new THREE.InstancedMesh(sphereGeometry, atomMaterial, atomCount);
            
            filteredMolecule.atoms.forEach((atom, i) => {
                const radius = style === 'spaceFilling' 
                    ? vdwRadii[atom.element.toUpperCase()] || vdwRadii.DEFAULT
                    : atomRadii[atom.element.toUpperCase()] || atomRadii.DEFAULT;
                
                dummy.position.copy(positions[i]);
                dummy.rotation.set(0,0,0);
                dummy.scale.setScalar(radius);
                dummy.updateMatrix();
                
                atomMesh.setMatrixAt(i, dummy.matrix);
                atomMesh.setColorAt(i, _color.setHex(atomColors[atom.element.toUpperCase()] || atomColors.DEFAULT));
            });
            atomMesh.instanceMatrix.needsUpdate = true;
            if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true;
            moleculeGroup.add(atomMesh);
        }

        // --- BONDS (InstancedMesh) ---
        if (style !== 'spaceFilling') {
            const bondRadius = style === 'wireframe' ? 0.05 : 0.12;
            let bondInstanceCount = 0;
            filteredMolecule.bonds.forEach(bond => { bondInstanceCount += bond.order; });
            
            if (bondInstanceCount > 0) {
                const bondMesh = new THREE.InstancedMesh(cylinderGeometry, bondMaterial, bondInstanceCount);
                let bondIndex = 0;

                filteredMolecule.bonds.forEach(bond => {
                    const start = positions[bond.from];
                    const end = positions[bond.to];
                    if (!start || !end) return;

                    const dist = start.distanceTo(end);
                    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
                    const direction = new THREE.Vector3().subVectors(end, start).normalize();
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
                    
                    const bondVector = new THREE.Vector3().subVectors(end, start);
                    const offsetVector = new THREE.Vector3();
                    if (bondVector.x !== 0 || bondVector.y !== 0) {
                        offsetVector.set(-bondVector.y, bondVector.x, 0).normalize();
                    } else { offsetVector.set(1, 0, 0); }

                    for (let j = 0; j < bond.order; j++) {
                        const shift = offsetVector.clone().multiplyScalar((j - (bond.order - 1) / 2) * 0.3);
                        dummy.position.copy(mid).add(shift);
                        dummy.quaternion.copy(quaternion);
                        dummy.scale.set(bondRadius, dist, bondRadius);
                        dummy.updateMatrix();
                        
                        bondMesh.setMatrixAt(bondIndex++, dummy.matrix);
                    }
                });
                bondMesh.instanceMatrix.needsUpdate = true;
                moleculeGroup.add(bondMesh);
            }
        }

        // --- LABELS (Sprites) ---
        // Reset labels ref
        labelsRef.current = [];
        
        if (showLabels && (style !== 'spaceFilling' || showElectrons)) {
            filteredMolecule.atoms.forEach((atom, i) => {
                const radius = style === 'spaceFilling' 
                    ? (vdwRadii[atom.element.toUpperCase()] || vdwRadii.DEFAULT) 
                    : (atomRadii[atom.element.toUpperCase()] || atomRadii.DEFAULT);
                
                const atomHexColor = atomColors[atom.element.toUpperCase()] || atomColors.DEFAULT;
                const texture = getLabelTexture(atom.element, atomHexColor);
                
                if (texture) {
                    const spriteMat = new THREE.SpriteMaterial({ 
                        map: texture, 
                        depthTest: true, // Keep depth test so it hides behind other atoms if really far back
                        transparent: true 
                    });
                    const sprite = new THREE.Sprite(spriteMat);
                    
                    // We add the sprite to the SCENE, not the molecule group.
                    // This allows us to manually position it perfectly relative to the camera in the animation loop.
                    scene.add(sprite);
                    
                    const image = texture.image;
                    // Determine scale based on atom type and image aspect ratio
                    if (image && image.width && image.height) {
                        const aspect = image.width / image.height;
                        const isHydrogen = atom.element.toUpperCase() === 'H';
                        // Bigger for C/others (0.6), smaller for H (0.45)
                        const baseScale = isHydrogen ? 0.45 : 0.6; 
                        
                        // Set scale to match texture aspect ratio to prevent squeezing
                        sprite.scale.set(baseScale * aspect, baseScale, 1);
                    } else {
                        // Fallback
                        sprite.scale.set(0.5, 0.5, 1);
                    }
                    
                    labelsRef.current.push({
                        sprite,
                        atomIndex: i,
                        radius: radius
                    });
                }
            });
        }

        // --- ELECTRON CLOUD / ORBITALS ---
        if (showElectronCloud) {
            filteredMolecule.atoms.forEach((atom, i) => {
                const cloud = new THREE.Mesh(
                    new THREE.SphereGeometry((vdwRadii[atom.element.toUpperCase()] || 1.5), 16, 16),
                    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.15, depthWrite: false })
                );
                cloud.position.copy(positions[i]);
                moleculeGroup.add(cloud);
            });
        }

        // Optimize electrons with THREE.Points (Glowing Sprites)
        let electronsPoints: THREE.Points | null = null;
        let electronsData: {
            center: THREE.Vector3,
            rx: number,
            ry: number,
            speed: number,
            angle: number,
            axis: THREE.Vector3,
            index: number
        }[] = [];

        if (showElectrons) {
            let totalElectrons = 0;
            filteredMolecule.atoms.forEach((atom) => {
                totalElectrons += valenceElectrons[atom.element.toUpperCase()] || 0;
            });
            
            if (totalElectrons > 0) {
                const positionsArray = new Float32Array(totalElectrons * 3);
                let idx = 0;
                
                filteredMolecule.atoms.forEach((atom, atomIndex) => {
                    const num = valenceElectrons[atom.element.toUpperCase()] || 0;
                    const pos = positions[atomIndex];
                    const r = (vdwRadii[atom.element.toUpperCase()] || 1.5) * 0.8;
                    for(let k=0; k<num; k++){
                        electronsData.push({
                            center: pos,
                            rx: r * (0.8 + Math.random()*0.4),
                            ry: r * (0.8 + Math.random()*0.4),
                            speed: 0.03 + Math.random()*0.04,
                            angle: Math.random() * Math.PI * 2,
                            axis: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
                            index: idx
                        });
                        
                        positionsArray[idx * 3] = pos.x;
                        positionsArray[idx * 3 + 1] = pos.y;
                        positionsArray[idx * 3 + 2] = pos.z;
                        idx++;
                    }
                });

                const electronGeo = new THREE.BufferGeometry();
                electronGeo.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
                
                const electronMat = new THREE.PointsMaterial({
                    size: 0.8,
                    map: getElectronTexture(),
                    transparent: true,
                    opacity: 0.9,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    color: 0xffffff
                });
                
                electronsPoints = new THREE.Points(electronGeo, electronMat);
                moleculeGroup.add(electronsPoints);
            }
        }

        scene.add(moleculeGroup);

        // Auto-fit camera to molecule size
        const box = new THREE.Box3().setFromObject(moleculeGroup);
        if (!box.isEmpty()) {
            const center = box.getCenter(new THREE.Vector3());
            const sphere = box.getBoundingSphere(new THREE.Sphere(center));
            const radius = sphere.radius;
            
            // Artificial floor for radius to prevent extreme zoom-ins on tiny molecules (like water)
            const adjustedRadius = Math.max(radius, 3.5);

            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(adjustedRadius / Math.sin(fov / 2));
            if (camera.aspect < 1) {
                cameraZ /= camera.aspect;
            }
            camera.position.z = center.z + cameraZ * 1.15; // padding
            controls.target.copy(center);
        } else {
            camera.position.z = 18;
        }

        // Animation Loop
        let frameId: number;
        const animate = () => {
            frameId = requestAnimationFrame(animate);
            if (autoRotateRef.current) {
                moleculeGroup.rotation.y += 0.005;
            }
            
            // Update electrons
            if (showElectrons && electronsPoints) {
                const positionsAttr = electronsPoints.geometry.attributes.position as THREE.BufferAttribute;
                electronsData.forEach((d) => {
                    d.angle += d.speed;
                    _vec3.set(Math.cos(d.angle)*d.rx, Math.sin(d.angle)*d.ry, 0);
                    _vec3.applyAxisAngle(d.axis, d.angle * 0.2);
                    _vec3.add(d.center);
                    positionsAttr.setXYZ(d.index, _vec3.x, _vec3.y, _vec3.z);
                });
                positionsAttr.needsUpdate = true;
            }

            // Update Labels to float "on top" of atoms facing the camera
            if (labelsRef.current.length > 0) {
                // Ensure the world matrix is up to date since we rely on it for positioning
                moleculeGroup.updateMatrixWorld();
                
                labelsRef.current.forEach(item => {
                    const atomPosLocal = positions[item.atomIndex];
                    
                    // 1. Get atom's current world position (accounting for rotation)
                    _vec3.copy(atomPosLocal).applyMatrix4(moleculeGroup.matrixWorld);
                    
                    // 2. Calculate direction from atom center to camera
                    _cameraDir.subVectors(camera.position, _vec3).normalize();
                    
                    // 3. Move sprite from center along that direction by radius + offset
                    // This places it on the "surface" of the atom facing the camera.
                    // Increased offset slightly for larger labels to avoid clipping
                    _vec3.addScaledVector(_cameraDir, item.radius + 0.45); 
                    
                    item.sprite.position.copy(_vec3);
                });
            }

            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            if (!currentMount) return;
            const width = currentMount.clientWidth;
            const height = currentMount.clientHeight;
            
            if (width === 0 || height === 0) return;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        // Use ResizeObserver for more robust sizing (especially in flex/grid layouts)
        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(currentMount);

        // Initial resize
        handleResize();

        return () => {
            resizeObserver.disconnect();
            cancelAnimationFrame(frameId);
            if (currentMount) {
                currentMount.removeChild(renderer.domElement);
            }
            renderer.dispose();
            scene.traverse((obj) => {
                if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
                    obj.geometry.dispose();
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else (obj.material as THREE.Material).dispose();
                }
            });
            // Cleanup labels manually added to scene
            labelsRef.current.forEach(l => {
                scene.remove(l.sprite);
                l.sprite.material.dispose();
            });
        };
    }, [filteredMolecule, style, showLabels, showElectrons, showElectronCloud]);

    if (isFullScreen) {
        return (
            <div className={`relative w-full h-full overflow-hidden ${transparent ? 'bg-transparent' : 'bg-white dark:bg-black'}`}>
                <div ref={mountRef} className="absolute inset-0 z-0" />

                {/* Bottom Info Panel (Accordion) */}
                {!hideControls && (
                    <div className="absolute bottom-6 left-4 right-4 md:left-8 md:right-8 z-10 max-w-4xl mx-auto">
                    <div className="bg-white/90 dark:bg-black/80 backdrop-blur-xl rounded-2xl border border-neutral-200 dark:border-white/10 shadow-2xl overflow-hidden transition-all duration-500 max-h-[80vh] flex flex-col">
                        
                        {/* Header / Summary */}
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors" onClick={() => setIsControlsOpen(prev => !prev)}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    {molecule.iupacName && <h2 className={`text-lg md:text-xl font-bold text-neutral-900 dark:text-white ${isControlsOpen ? 'break-words' : 'truncate'}`}>{molecule.iupacName}</h2>}
                                </div>
                            </div>
                            <div className={`p-1.5 transition-transform duration-300 ${isControlsOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                            </div>
                        </summary>

                        {/* Expanded Content */}
                        <div className={`transition-all duration-500 ease-in-out overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isControlsOpen ? 'max-h-[60vh] opacity-100 border-t border-neutral-200 dark:border-white/10' : 'max-h-0 opacity-0'}`}>
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                
                                {/* Column 1: Visualization Controls */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">Display</h3>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                <StyleRadioButton id="style-ball-fs" label="Ball/Stick" value="ballAndStick" checked={style === 'ballAndStick'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} isOverlay />
                                                <StyleRadioButton id="style-sticks-fs" label="Sticks" value="sticks" checked={style === 'sticks'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} isOverlay />
                                                <StyleRadioButton id="style-wire-fs" label="Wireframe" value="wireframe" checked={style === 'wireframe'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} isOverlay />
                                                <StyleRadioButton id="style-space-fs" label="Space" value="spaceFilling" checked={style === 'spaceFilling'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} isOverlay />
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                <CustomCheckbox id="opt-h-fs" label="Hydrogens" checked={showHydrogens} onChange={e => updateState({ showHydrogens: e.target.checked })} isOverlay />
                                                <CustomCheckbox id="opt-labels-fs" label="Labels" checked={showLabels} onChange={e => updateState({ showLabels: e.target.checked })} isOverlay />
                                                <CustomCheckbox id="opt-cloud-fs" label="Cloud" checked={showElectronCloud} onChange={e => updateState({ showElectronCloud: e.target.checked })} isOverlay />
                                                <CustomCheckbox id="opt-rot-fs" label="Rotate" checked={autoRotate} onChange={e => updateState({ autoRotate: e.target.checked })} isOverlay />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Physical Properties */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">Physical Properties</h3>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div className="p-2 bg-neutral-50 dark:bg-white/5 rounded-lg flex flex-col">
                                                <span className="text-neutral-500">Exact Mass</span>
                                                <span className="font-mono text-neutral-800 dark:text-neutral-200">{molecule.exactMass ?? 'N/A'}</span>
                                            </div>
                                            <div className="p-2 bg-neutral-50 dark:bg-white/5 rounded-lg flex flex-col">
                                                <span className="text-neutral-500">TPSA</span>
                                                <span className="font-mono text-neutral-800 dark:text-neutral-200">{molecule.topologicalPolarSurfaceArea ?? 'N/A'} Å²</span>
                                            </div>
                                            <div className="p-2 bg-neutral-50 dark:bg-white/5 rounded-lg flex flex-col">
                                                <span className="text-neutral-500">H-Donors</span>
                                                <span className="font-mono text-amber-600 dark:text-amber-500">{molecule.hBondDonorCount ?? 0}</span>
                                            </div>
                                            <div className="p-2 bg-neutral-50 dark:bg-white/5 rounded-lg flex flex-col">
                                                <span className="text-neutral-500">H-Acceptors</span>
                                                <span className="font-mono text-amber-600 dark:text-amber-500">{molecule.hBondAcceptorCount ?? 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 3: Identifiers */}
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2">Identifiers</h3>
                                        <div className="space-y-3">
                                            {molecule.molecularFormula && (
                                                <div className="group relative">
                                                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase mb-0.5">Formula</p>
                                                    <div className="inline-block px-2 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded font-mono text-[11px] text-amber-600 dark:text-amber-500 w-fit">
                                                        {molecule.molecularFormula}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-4 w-full">
                                                <ExpandableText label="Canonical SMILES" text={molecule.canonicalSMILES || ''} />
                                                <ExpandableText label="InChI Key" text={molecule.inchiKey || ''} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`${transparent ? 'bg-transparent border-none shadow-none' : 'bg-neutral-100 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 shadow-md'} rounded-lg my-4 overflow-hidden`}>
            <div className="relative w-full aspect-video">
                <div ref={mountRef} className="absolute inset-0" />
                <div className="absolute top-2 right-2 flex items-center gap-2">
                    {onMaximize && (
                        <Tooltip content="Full Screen View">
                            <button onClick={onMaximize} className="p-2 bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 rounded-full transition-colors">
                                <Maximize className="h-5 w-5" />
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip content="Toggle Electrons">
                        <button onClick={() => updateState({ showElectrons: !showElectrons })} className="p-2 bg-black/30 backdrop-blur-sm hover:bg-black/50 rounded-full transition-colors text-white">
                            <Atom className={`h-5 w-5 transition-colors ${showElectrons ? 'text-amber-400' : ''}`} />
                        </button>
                    </Tooltip>
                </div>
            </div>
            {(molecule.iupacName || molecule.molecularFormula) && (
                <div className="p-3 border-t border-neutral-200 dark:border-gray-700 text-sm cursor-pointer hover:bg-neutral-200/50 dark:hover:bg-gray-700/50 transition-colors" onClick={() => setIsControlsOpen(prev => !prev)}>
                    <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            {molecule.iupacName && <p className={`font-semibold text-neutral-800 dark:text-gray-200 ${isControlsOpen ? 'break-words' : 'truncate'}`}>{molecule.iupacName}</p>}
                        </div>
                        <ChevronDown className={`h-5 w-5 text-neutral-500 dark:text-gray-400 transition-transform duration-300 ${isControlsOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            )}
            <div className={`grid transition-all duration-500 ease-in-out ${isControlsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className="p-4 border-t border-neutral-200 dark:border-gray-700 bg-white/50 dark:bg-black/20">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold mb-2 text-neutral-500 dark:text-gray-400">Style</p>
                                <div className="flex flex-wrap gap-2">
                                   <StyleRadioButton id="style-ball" label="Ball and Stick" value="ballAndStick" checked={style === 'ballAndStick'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} />
                                   <StyleRadioButton id="style-sticks" label="Sticks" value="sticks" checked={style === 'sticks'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} />
                                   <StyleRadioButton id="style-wire" label="Wireframe" value="wireframe" checked={style === 'wireframe'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} />
                                   <StyleRadioButton id="style-space" label="Space-filling" value="spaceFilling" checked={style === 'spaceFilling'} onChange={e => updateState({ style: e.target.value as MoleculeStyle })} />
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold mb-2 text-neutral-500 dark:text-gray-400">Options</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                   <CustomCheckbox id="opt-h" label="Show Hydrogens" checked={showHydrogens} onChange={e => updateState({ showHydrogens: e.target.checked })} />
                                   <CustomCheckbox id="opt-labels" label="Show Labels" checked={showLabels} onChange={e => updateState({ showLabels: e.target.checked })} />
                                   <CustomCheckbox id="opt-rot" label="Auto-rotate" checked={autoRotate} onChange={e => updateState({ autoRotate: e.target.checked })} />
                                   <CustomCheckbox id="opt-cloud" label="Show Electron Cloud" checked={showElectronCloud} onChange={e => updateState({ showElectronCloud: e.target.checked })} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(MoleculeViewer);