import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, LoaderCircle, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useToast } from './ToastSystem';

interface UpdatePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const UpdatePasswordModal: React.FC<UpdatePasswordModalProps> = ({ isOpen, onClose }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    const getStrength = (pass: string) => {
        let score = 0;
        if (!pass) return 0;
        if (pass.length > 8) score += 1;
        if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) score += 1;
        if (/\d/.test(pass)) score += 1;
        if (/[^a-zA-Z0-9]/.test(pass)) score += 1;
        return score;
    };

    const autoGenerate = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,./-=";
        let pass = "";
        for (let i = 0; i < 16; i++) {
            pass += chars[Math.floor(Math.random() * chars.length)];
        }
        setPassword(pass);
        setConfirmPassword(pass);
        setShowPassword(true);
        setShowConfirmPassword(true);
    };

    const strength = getStrength(password);
    const strengthLabels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (strength < 2) {
            setError("Password is too weak");
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            addToast('Password updated successfully!', 'success');
            
            // Trigger the edge function to alert the user about the password change
            supabase.functions.invoke('send-password-alert', {
                body: { siteUrl: window.location.origin }
            }).catch(console.error);

            setTimeout(() => {
                onClose();
            }, 500);
        } catch (err: any) {
            const errorMsg = err.error_description || err.message;
            setError(errorMsg);
            addToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" />
            <div className="relative w-full max-w-[400px] bg-white/90 dark:bg-black backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden transform transition-all duration-500 scale-100 opacity-100">
                <div className="px-8 pt-10 pb-8">
                    <div className="text-center mb-8 relative z-10">
                        <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">Update Password</h2>
                        <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2 font-medium">Please enter your new password.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors">
                                <Lock className="h-5 w-5" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="New Password"
                                className="w-full bg-neutral-50 dark:bg-[#0f1115] border border-neutral-200 dark:border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        
                        {password && (
                            <div className="space-y-2 animate-fade-in-up">
                                <div className="flex justify-between items-center text-xs font-medium">
                                    <span className="text-neutral-500 dark:text-gray-400">Password strength</span>
                                    <span className={`px-2 py-0.5 rounded-full text-white ${strengthColors[strength]}`}>
                                        {strengthLabels[strength]}
                                    </span>
                                </div>
                                <div className="flex gap-1 h-1">
                                    {[1, 2, 3, 4].map((level) => (
                                        <div
                                            key={level}
                                            className={`flex-1 rounded-full transition-all duration-300 ${
                                                strength >= level ? strengthColors[strength] : 'bg-neutral-200 dark:bg-neutral-800'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div className="group relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors">
                                <Lock className="h-5 w-5" />
                            </div>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm Password"
                                className="w-full bg-neutral-50 dark:bg-[#0f1115] border border-neutral-200 dark:border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        
                        <div className="flex justify-end">
                            <button 
                                type="button" 
                                onClick={autoGenerate}
                                className="text-xs font-semibold text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                            >
                                ✨ Generate password
                            </button>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 animate-fade-in-up font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                {error}
                            </div>
                        )}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} disabled={loading} className="w-1/3 py-4 text-neutral-700 dark:text-neutral-300 font-bold rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 transition-all disabled:opacity-70">
                                Cancel
                            </button>
                            <button type="submit" disabled={loading || password !== confirmPassword || strength < 2} className="flex-1 group relative flex items-center justify-center gap-2 py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-xl overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-70">
                                {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <><span>Update</span><ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
export default UpdatePasswordModal;
