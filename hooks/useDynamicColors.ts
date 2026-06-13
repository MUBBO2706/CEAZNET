
import { useState, useEffect } from 'react';
import { supabase, supabaseUrl } from '../services/supabaseClient';
import { getImage } from '../services/imageCachingService';

export interface DynamicColors {
    background: string;
    exploreBg: string;
    text: string;
    subText: string;
    sourceBg: string;
}

export const defaultColors: DynamicColors = {
    background: 'linear-gradient(135deg, #4a5568, #2d3748)',
    exploreBg: 'linear-gradient(135deg, #374151, #1f2937)',
    text: 'rgba(255,255,255,0.95)',
    subText: 'rgba(255,255,255,0.7)',
    sourceBg: 'rgba(255, 255, 255, 0.1)',
};

// Module-level cache to store results and prevent re-computation for the same image URL.
const colorCache = new Map<string, DynamicColors>();
const pendingFetches = new Map<string, Promise<DynamicColors>>();

// --- Color Conversion Utilities ---
interface HSL { h: number; s: number; l: number; }

const rgbToHsl = (r: number, g: number, b: number): HSL => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
};

// --- Palette Generation ---
const generatePalette = (r: number, g: number, b: number): DynamicColors => {
    const { h, s, l } = rgbToHsl(r, g, b);
    
    // Card background: Darker, saturated base
    const cardStart = `hsl(${h}, ${Math.min(s, 65)}%, ${Math.max(l - 10, 20)}%)`;
    const cardEnd = `hsl(${h + 20}, ${Math.min(s, 75)}%, 15%)`;

    // View background: Even darker, less saturated for depth
    const viewStart = `hsl(${h}, ${Math.min(s, 30)}%, 12%)`;
    const viewEnd = `hsl(${h + 25}, ${Math.min(s, 40)}%, 8%)`;

    return {
        background: `linear-gradient(160deg, ${cardStart} 0%, ${cardEnd} 100%)`,
        exploreBg: `linear-gradient(160deg, ${viewStart} 0%, ${viewEnd} 100%)`,
        text: 'rgba(255,255,255,0.95)',
        subText: 'rgba(255,255,255,0.7)',
        sourceBg: 'rgba(255, 255, 255, 0.1)',
    };
};

const fetchAndProcessColors = (imageUrl: string): Promise<DynamicColors> => {
    if (colorCache.has(imageUrl)) return Promise.resolve(colorCache.get(imageUrl)!);
    if (pendingFetches.has(imageUrl)) return pendingFetches.get(imageUrl)!;

    const promise = new Promise<DynamicColors>((resolve) => {
        const processImageFromSrc = (imageSrc: string) => {
            const img = new Image();
            if (!imageSrc.startsWith('data:')) {
                img.crossOrigin = "Anonymous";
            }
            img.src = imageSrc;

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const size = 10;
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (!ctx) { throw new Error('Could not get canvas context'); }
                    
                    ctx.drawImage(img, 0, 0, size, size);
                    const data = ctx.getImageData(0, 0, size, size).data;
                    const colorCounts: Record<string, number> = {};
                    
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i + 3] < 128) continue; // Skip transparent pixels
                        const r = data[i], g = data[i+1], b = data[i+2];
                        const key = `${r},${g},${b}`;
                        colorCounts[key] = (colorCounts[key] || 0) + 1;
                    }

                    const sortedColors = Object.entries(colorCounts)
                        .map(([key, count]) => {
                            const [r, g, b] = key.split(',').map(Number);
                            const { h, s, l } = rgbToHsl(r, g, b);
                            return { r, g, b, s, l, count };
                        })
                        .sort((a, b) => b.count - a.count);

                    if (sortedColors.length === 0) { throw new Error('No colors found in image'); }

                    const bestColor = sortedColors
                        .slice(0, 10)
                        .map(color => {
                            const saturationScore = color.s > 10 ? color.s : 0; 
                            const lightnessScore = 1 - Math.abs(color.l - 50) / 50;
                            const score = color.count * saturationScore * lightnessScore;
                            return { ...color, score };
                        })
                        .sort((a, b) => b.score - a.score)[0];

                    let newPalette;
                    if (bestColor && bestColor.score > 0) {
                        newPalette = generatePalette(bestColor.r, bestColor.g, bestColor.b);
                    } else {
                        newPalette = defaultColors;
                    }

                    colorCache.set(imageUrl, newPalette);
                    resolve(newPalette);
                } catch (error) {
                    console.warn(`CORS error processing image directly for dynamic colors:`, error, imageUrl);
                    colorCache.set(imageUrl, defaultColors);
                    resolve(defaultColors);
                } finally {
                    pendingFetches.delete(imageUrl);
                }
            };

            img.onerror = () => {
                console.warn("Failed to load image for color extraction (onerror):", imageUrl);
                colorCache.set(imageUrl, defaultColors);
                pendingFetches.delete(imageUrl);
                resolve(defaultColors);
            };
        };

        // Check IndexedDB local cache first (cached under 2 hours)
        getImage(imageUrl).then(cachedDataUrl => {
            if (cachedDataUrl) {
                processImageFromSrc(cachedDataUrl);
            } else {
                const PROXY_URL = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
                fetch(PROXY_URL)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`Proxy fetch failed with status ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.error) {
                            throw new Error(`Proxy function error: ${data.error}`);
                        }
                        processImageFromSrc(data.dataUrl);
                    })
                    .catch(error => {
                        console.warn(`Image proxy failed for ${imageUrl}, falling back to direct load. Error: ${error.message}`);
                        processImageFromSrc(imageUrl);
                    });
            }
        });
    });

    pendingFetches.set(imageUrl, promise);
    return promise;
};

export const useDynamicColors = (imageUrl: string | null, enabled: boolean = true): { colors: DynamicColors, isLoading: boolean } => {
    const [palette, setPalette] = useState<DynamicColors | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!enabled || !imageUrl) {
            setPalette(defaultColors);
            setIsLoading(false);
            return;
        }

        if (colorCache.has(imageUrl)) {
            setPalette(colorCache.get(imageUrl)!);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        fetchAndProcessColors(imageUrl)
            .then(newPalette => {
                setPalette(newPalette);
            })
            .catch(() => {
                setPalette(defaultColors);
            })
            .finally(() => {
                setIsLoading(false);
            });

    }, [imageUrl, enabled]);

    return { colors: palette || defaultColors, isLoading };
};
