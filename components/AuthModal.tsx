
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { X, LoaderCircle, Mail, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useToast } from './ToastSystem';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isVerificationPending, setIsVerificationPending] = useState(false);
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
        if (!email.trim()) return;
        const basePart = email.split('@')[0];
        const capitalizedBase = basePart ? basePart.charAt(0).toUpperCase() + basePart.slice(1).toLowerCase() : 'User';
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,./-=";
        let randomPart = "";
        for (let i = 0; i < 8; i++) {
            randomPart += chars[Math.floor(Math.random() * chars.length)];
        }
        const pass = `${capitalizedBase}!1${randomPart}`;
        setPassword(pass);
        setShowPassword(true);
    };

    const strength = getStrength(password);
    const strengthLabels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
        }
    }, [isOpen]);

    const handleVerifiedClick = async () => {
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                 if (error.message.toLowerCase().includes('email not confirmed')) {
                     throw new Error("It looks like you haven't verified yet. Please check your email and click the confirmation link.");
                 }
                 throw error;
            }
            addToast('Successfully logged in!', 'success');
            handleClose();
        } catch (err: any) {
            const errorMsg = err.error_description || err.message;
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isForgotPasswordView) {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin,
                });
                if (error) throw error;
                addToast('Password reset link sent to your email.', 'success');
                setIsForgotPasswordView(false);
                setIsLoginView(true);
            } else if (isLoginView) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                addToast('Successfully logged in!', 'success');
                handleClose();
            } else {
                const generatedAvatarUrl = `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(email)}`;
                
                const { data, error } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            avatar_url: generatedAvatarUrl
                        },
                        emailRedirectTo: window.location.origin
                    }
                });
                if (error) throw error;
                setIsVerificationPending(true);
                addToast('Signup successful! Please check your email.', 'success');
            }
        } catch (err: any) {
            const errorMsg = err.error_description || err.message;
            setError(errorMsg);
            addToast(errorMsg, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const handleClose = () => {
        if (loading) return;
        setIsAnimating(false);
        setTimeout(() => {
            setEmail('');
            setPassword('');
            setFullName('');
            setError(null);
            setMessage(null);
            setIsLoginView(true);
            setIsForgotPasswordView(false);
            setIsVerificationPending(false);
            onClose();
        }, 300); // Wait for animation
    }

    if (!isOpen && !isAnimating) return null;

    return (
        <div 
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
            {/* Deep Dark/Light Backdrop with Blur */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-xl transition-opacity" 
                onClick={handleClose}
            />

            <div 
                className={`relative w-full max-w-[400px] transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glowing Gradient Border Effect */}
                <div className="absolute -inset-[1px] bg-gradient-to-br from-amber-500 via-purple-600 to-blue-600 rounded-[2rem] opacity-30 dark:opacity-60 blur-sm" />
                
                {/* Main Card */}
                <div className="relative bg-white/90 dark:bg-black backdrop-blur-2xl rounded-[1.9rem] shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden">
                    
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-900/10 pointer-events-none" />
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Close Button */}
                    <button 
                        onClick={handleClose} 
                        className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="px-8 pt-10 pb-8">
                        {/* Header Section */}
                        {!isVerificationPending && !isForgotPasswordView && (
                            <div className="text-center mb-8 relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                                    {isLoginView ? 'Welcome Back' : 'Create Account'}
                                </h2>
                                <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2 font-medium">
                                    {isLoginView ? 'Enter your details to access your space.' : 'Join Ceaznet to unlock full potential.'}
                                </p>
                            </div>
                        )}

                        {!isVerificationPending && isForgotPasswordView && (
                            <div className="text-center mb-8 relative z-10">
                                <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
                                    Reset Password
                                </h2>
                                <p className="text-sm text-neutral-500 dark:text-gray-400 mt-2 font-medium">
                                    Enter your email to receive a reset link.
                                </p>
                            </div>
                        )}

                        {/* Custom Sliding Tab Switcher - Pill Style */}
                        {!isVerificationPending && !isForgotPasswordView && (
                            <div className="relative p-1 mb-8 bg-neutral-100 dark:bg-black/40 rounded-full border border-neutral-200 dark:border-white/5">
                                <div 
                                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-[#2C2D31] rounded-full shadow-sm transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isLoginView ? 'left-1 translate-x-0' : 'left-[calc(50%+4px)] translate-x-0'}`}
                                />
                                <div className="relative z-10 flex">
                                    <button
                                        onClick={() => { setIsLoginView(true); setError(null); setMessage(null); }}
                                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 ${isLoginView ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-gray-500 hover:text-neutral-700 dark:hover:text-gray-300'}`}
                                    >
                                        Sign In
                                    </button>
                                    <button
                                        onClick={() => { setIsLoginView(false); setError(null); setMessage(null); }}
                                        className={`flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 ${!isLoginView ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 dark:text-gray-500 hover:text-neutral-700 dark:hover:text-gray-300'}`}
                                    >
                                        Sign Up
                                    </button>
                                </div>
                            </div>
                        )}

                        {isVerificationPending ? (
                            <div className="space-y-6 relative z-10 animate-fade-in-up">
                                <div className="text-center">
                                    <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                                        <Mail className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Check your email</h3>
                                    <p className="text-sm text-neutral-600 dark:text-gray-300 mt-3 font-medium">
                                        We sent a verification link to <br/><span className="font-bold text-neutral-900 dark:text-white">{email}</span>
                                    </p>
                                    <p className="text-sm text-neutral-500 dark:text-gray-400 mt-4 bg-neutral-50 dark:bg-white/5 p-3 rounded-xl border border-neutral-100 dark:border-white/10 text-left leading-relaxed">
                                        1. Click the link we sent you (it's okay if it opens in Gmail or another app).<br />
                                        2. After clicking, come back to this screen.<br />
                                        3. Tap the button below.
                                    </p>
                                </div>
                                
                                {error && (
                                    <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 font-medium animate-fade-in-up">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                        {error}
                                    </div>
                                )}
                                
                                <button
                                    onClick={handleVerifiedClick}
                                    disabled={loading}
                                    className="group relative w-full flex items-center justify-center gap-2 py-4 bg-amber-500 text-white font-bold rounded-full overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none"
                                >
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                    {loading ? (
                                        <LoaderCircle className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span className="text-base">I have verified</span>
                                    )}
                                </button>
                                
                                <button
                                     onClick={() => { setIsVerificationPending(false); setError(null); }}
                                     className="w-full py-2 text-sm font-semibold text-neutral-500 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                                >
                                     Back
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                            {!isLoginView && !isForgotPasswordView && (
                                <div className="group relative animate-fade-in-up">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-full py-3.5 pl-12 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
                                        required
                                    />
                                </div>
                            )}
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email address"
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-full py-3.5 pl-12 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
                                    required
                                />
                            </div>
                            
                            {!isForgotPasswordView && (
                                <>
                                    <div className="group relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-amber-500 transition-colors">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Password"
                                            className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-full py-3.5 pl-12 pr-12 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all shadow-sm"
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
                                    
                                    {!isLoginView && password && (
                                        <div className="space-y-2 animate-fade-in-up px-1">
                                            <div className="flex justify-between items-center text-xs font-medium">
                                                <span className="text-neutral-500 dark:text-gray-400">Strength</span>
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
                                    
                                    {!isLoginView && (
                                        <div className="flex justify-end px-1 pt-1">
                                            <button 
                                                type="button" 
                                                onClick={autoGenerate}
                                                disabled={!email.trim()}
                                                className={`text-xs font-semibold transition-colors ${!email.trim() ? 'text-neutral-400 cursor-not-allowed opacity-60' : 'text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400'}`}
                                            >
                                                ✨ Generate password
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {isLoginView && !isForgotPasswordView && (
                                <div className="flex justify-end pt-1">
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsForgotPasswordView(true); setError(null); setMessage(null); }}
                                        className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            )}

                            {/* Messages */}
                            <div className="min-h-[20px]">
                                {error && (
                                    <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/30 animate-fade-in-up font-medium">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        {error}
                                    </div>
                                )}
                                {message && (
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-100 dark:border-green-900/30 animate-fade-in-up font-medium">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        {message}
                                    </div>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading || !!message}
                                className="group relative w-full flex items-center justify-center gap-2 py-4 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-full overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-none mt-2"
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                                {loading ? (
                                    <LoaderCircle className="h-5 w-5 animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-base">{isForgotPasswordView ? 'Send Reset Link' : (isLoginView ? 'Continue' : 'Create Account')}</span>
                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>

                            {!isForgotPasswordView && (
                                <>
                                    <div className="relative my-6">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-neutral-200 dark:border-white/10"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="px-2 bg-white dark:bg-black text-neutral-500">Or continue with</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={async () => {
                                            setLoading(true);
                                            setError(null);
                                            try {
                                                const { error } = await supabase.auth.signInWithOAuth({
                                                    provider: 'google',
                                                    options: {
                                                        redirectTo: window.location.origin
                                                    }
                                                });
                                                if (error) throw error;
                                            } catch (err: any) {
                                                const errorMsg = err.error_description || err.message;
                                                setError(errorMsg);
                                                addToast(errorMsg, 'error');
                                                setLoading(false);
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-3 py-3.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-white/5 dark:hover:bg-white/10 text-neutral-900 dark:text-white font-semibold rounded-full transition-all border border-neutral-200 dark:border-white/10 active:scale-[0.98]"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Google
                                    </button>
                                </>
                            )}

                            {isForgotPasswordView && (
                                <div className="mt-4 text-center">
                                    <button 
                                        type="button" 
                                        onClick={() => { setIsForgotPasswordView(false); setError(null); setMessage(null); }}
                                        className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white font-semibold transition-colors"
                                    >
                                        Back to Log In
                                    </button>
                                </div>
                            )}
                        </form>
                        )}
                    </div>
                    
                    {/* Footer Branding */}
                    <div className="bg-neutral-50/80 dark:bg-black/30 p-4 text-center border-t border-neutral-100 dark:border-white/5 backdrop-blur-sm">
                        <p className="text-[10px] text-neutral-400 dark:text-gray-600 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <Lock className="w-3 h-3" /> Secured by Supabase
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
