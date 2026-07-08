import React from 'react';
import { motion } from 'motion/react';
import { Home, ArrowLeft } from 'lucide-react';
import { View } from '../types';

interface NotFoundViewProps {
    onNavigate: (view: View) => void;
}

const NotFoundView: React.FC<NotFoundViewProps> = ({ onNavigate }) => {

    return (
        <div 
            className="flex flex-1 flex-col items-center justify-center h-full w-full relative overflow-hidden bg-[#050505] text-white select-none"
        >
            {/* dynamic background gradients behind */}
            <div className="absolute top-[10%] left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full bg-indigo-600/20 blur-[100px] pointer-events-none"></div>
            
            {/* Main Content */}
            <div className="z-10 flex flex-col items-center text-center px-6 relative w-full max-w-4xl">
                
                {/* Custom Animated 404 */}
                <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
                    className="w-full flex justify-center items-center gap-4 mb-12 relative pointer-events-none"
                >
                    <motion.div
                         animate={{ y: [0, -20, 0] }}
                         transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                         className="text-[120px] md:text-[200px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-600 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                        4
                    </motion.div>
                    <motion.div
                         animate={{ y: [0, 20, 0], rotate: [0, 10, -10, 0] }}
                         transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                         className="text-[120px] md:text-[200px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-indigo-400 to-violet-600 drop-shadow-[0_0_50px_rgba(99,102,241,0.5)]"
                    >
                        0
                    </motion.div>
                    <motion.div
                         animate={{ y: [0, -25, 0] }}
                         transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                         className="text-[120px] md:text-[200px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-600 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                    >
                        4
                    </motion.div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.4 }}
                    className="max-w-[450px] mx-auto z-20 relative px-4"
                >
                    <p className="text-neutral-400 md:text-lg mb-8 leading-relaxed font-medium">
                        You've journeyed into uncharted territory. This sector is empty, but the universe is vast. Let's get you back.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.6 }}
                    className="z-20 relative"
                >
                    <motion.button
                        onClick={() => onNavigate('home')}
                        className="group relative flex items-center gap-3 px-6 py-3 bg-white text-black rounded-full font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] transition-all overflow-hidden cursor-pointer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {/* Button Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.15] via-purple-500/[0.15] to-pink-500/[0.15] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                        
                        <Home className="w-5 h-5 group-hover:-translate-y-1 group-hover:text-indigo-600 transition-all duration-300 relative z-10" />
                        <span className="relative z-10">Teleport Home</span>
                        
                        {/* Animated arrow on hover */}
                        <ArrowLeft className="w-4 h-4 absolute right-[-20px] opacity-0 group-hover:opacity-100 group-hover:right-4 transition-all duration-300 text-black z-10 rotate-180" />
                    </motion.button>
                </motion.div>
            </div>
        </div>
    );
};

export default NotFoundView;
