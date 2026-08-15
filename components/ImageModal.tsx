
import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageModalProps {
    images: string[];
    initialIndex: number;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ images, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const nextImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % images.length);
            if (e.key === 'ArrowLeft') setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [images.length, onClose]);

    return (
        <div 
          className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col z-[100]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-modal-title"
        >
            {/* Top Bar for Close Button */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-end z-50">
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110 focus:outline-none"
                  aria-label="Close gallery"
                >
                  <X className="h-6 w-6" />
                </button>
            </div>

            {/* Main Image Area */}
            <div className="flex-1 flex items-center justify-center p-4 w-full h-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <h2 id="image-modal-title" className="sr-only">Gallery View</h2>
                
                <img 
                    src={images[currentIndex]} 
                    alt={`Gallery image ${currentIndex + 1}`} 
                    // Limit height to ensure space for bottom controls (calc 100vh - header/footer space)
                    className="max-w-full max-h-[calc(100vh-140px)] w-auto h-auto object-contain rounded-lg shadow-2xl transition-opacity duration-300 select-none" 
                />
            </div>

            {/* Bottom Controls Area */}
            {images.length > 1 && (
                <div className="flex items-center justify-center gap-6 pb-8 pt-2 w-full z-50" onClick={(e) => e.stopPropagation()}>
                    <button 
                        onClick={prevImage}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all hover:scale-110 border border-white/10 shadow-lg group"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="h-6 w-6 group-active:scale-90 transition-transform" />
                    </button>

                    <div className="text-white/90 font-bold text-base bg-white/10 px-5 py-2.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg tracking-widest min-w-[5rem] flex items-center justify-center gap-2 select-none">
                        <span>{currentIndex + 1}</span>
                        <span className="opacity-50">/</span>
                        <span>{images.length}</span>
                    </div>

                    <button 
                        onClick={nextImage}
                        className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all hover:scale-110 border border-white/10 shadow-lg group"
                        aria-label="Next image"
                    >
                        <ChevronRight className="h-6 w-6 group-active:scale-90 transition-transform" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default ImageModal;
