import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap } from 'lucide-react';
import { ChargingOverlayState } from '../hooks/useChargingMode';

interface ChargingOverlayProps {
  state: ChargingOverlayState;
  batteryLevel: number | null;
}

const ChargingOverlay: React.FC<ChargingOverlayProps> = ({ state, batteryLevel }) => {
  return (
    <AnimatePresence>
      {state === 'animating' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto"
          style={{ touchAction: 'none' }}
        >
          <div className="relative flex flex-col items-center justify-center">
             {/* Beautiful charging ring animation */}
             <div className="relative w-48 h-48 flex items-center justify-center mb-8">
               <motion.div 
                 animate={{ 
                   rotate: 360
                 }}
                 transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                 className="absolute inset-0 rounded-full border-t-4 border-emerald-500 border-opacity-50"
               />
               <motion.div 
                 animate={{ 
                   scale: [1, 1.1, 1],
                   opacity: [0.7, 1, 0.7]
                 }}
                 transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                 className="w-32 h-32 rounded-full bg-emerald-500/10 flex items-center justify-center"
               >
                 <Zap className="w-16 h-16 text-emerald-400 fill-emerald-400" />
               </motion.div>
             </div>
             
             <h2 className="text-2xl font-bold text-white tracking-widest uppercase mb-2">Charging</h2>
             {batteryLevel !== null && (
               <p className="text-emerald-400 font-mono text-xl">{Math.round(batteryLevel * 100)}%</p>
             )}
          </div>
        </motion.div>
      )}

      {state === 'black-screen' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center pointer-events-auto"
          style={{ touchAction: 'none' }}
        >
          <div className="flex flex-col items-center justify-center opacity-40">
            <Zap className="w-6 h-6 text-emerald-500/50 mb-4" />
            <div className="text-neutral-500 text-sm font-medium text-center px-6">
              Please don't use the application while charging.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChargingOverlay;
