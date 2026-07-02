
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile } from '../types';
import type { User } from '@supabase/supabase-js';
import { X, LoaderCircle, Camera, User as UserIcon, Mail, Sparkles } from 'lucide-react';
import { useToast } from './ToastSystem';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    userProfile: UserProfile;
    onProfileUpdate: (updatedProfile: Partial<UserProfile>) => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, userProfile, onProfileUpdate }) => {
    const [fullName, setFullName] = useState(userProfile.full_name || '');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(userProfile.avatar_url);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    useEffect(() => {
        if (isOpen) {
            setIsAnimating(true);
            setFullName(userProfile.full_name || '');
            setPreviewUrl(userProfile.avatar_url || null);
            setAvatarFile(null);
            setError(null);
        }
    }, [isOpen, userProfile.full_name, userProfile.avatar_url]);

    const handleClose = () => {
        setIsAnimating(false);
        setTimeout(onClose, 300);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (userProfile.is_suspended) {
            addToast("Your account is suspended. Profile updates are disabled.", "error");
            return;
        }
        setLoading(true);
        setError(null);
        let avatarUrl = userProfile.avatar_url;

        try {
            // 1. Upload new avatar if one is selected
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile);
                
                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);
                
                avatarUrl = urlData.publicUrl;
            }

            // 2. Update profiles table
            const updates = {
                full_name: fullName,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            };
            
            const { error: updateError } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);
            
            if (updateError) throw updateError;
            
            // 3. Update local state and close
            onProfileUpdate({ full_name: fullName, avatar_url: avatarUrl });
            addToast('Profile updated successfully!', 'success');
            handleClose();

        } catch (err: any) {
            setError(err.error_description || err.message);
            addToast('Failed to update profile.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen && !isAnimating) return null;
    
    const initialAvatarUrl = userProfile.avatar_url 
        ? userProfile.avatar_url 
        : `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userProfile.full_name || user.email || 'A')}`;

    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Dynamic Backdrop */}
            <div 
                className="absolute inset-0 bg-[#0a0a0a]/60 dark:bg-black/80 backdrop-blur-md transition-opacity" 
                onClick={handleClose}
            />

            <div 
                className={`relative w-full max-w-[380px] transform transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) ${isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glowing Border Effect */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-[2rem] blur opacity-30 dark:opacity-50" />

                {/* Main Card */}
                <div className="relative bg-white/90 dark:bg-black backdrop-blur-xl rounded-[1.8rem] shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden">
                    
                    {/* Header Decor */}
                    <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-900/20 pointer-events-none" />

                    {/* Close Button */}
                    <button 
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-neutral-100/50 dark:hover:bg-white/5 transition-colors z-10"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="px-8 pt-8 pb-6">
                        {/* Title */}
                        <div className="text-center mb-6 relative">
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600 dark:from-white dark:to-neutral-400">
                                Edit Profile
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                                Update your personal details
                            </p>
                        </div>

                        {/* Avatar Section */}
                        <div className="flex justify-center mb-8">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                {/* Gradient Ring */}
                                <div className="absolute -inset-1 bg-gradient-to-tr from-amber-400 to-purple-600 rounded-full opacity-70 group-hover:opacity-100 blur-sm transition-opacity duration-500"></div>
                                
                                {/* Avatar Image */}
                                <div className="relative w-28 h-28 rounded-full p-1 bg-white dark:bg-[#1a1b1e]">
                                    <img 
                                        src={previewUrl || initialAvatarUrl} 
                                        alt="Profile avatar" 
                                        className="w-full h-full rounded-full object-cover bg-neutral-100 dark:bg-gray-800"
                                    />
                                </div>

                                {/* Overlay & Icon */}
                                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[1px]">
                                    <Camera className="h-8 w-8 text-white drop-shadow-md transform scale-90 group-hover:scale-100 transition-transform" />
                                </div>

                                {/* Floating Badge */}
                                <div className="absolute bottom-1 right-1 bg-white dark:bg-neutral-800 p-1.5 rounded-full shadow-md border border-neutral-100 dark:border-neutral-700 text-amber-500">
                                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                                </div>

                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" />
                            </div>
                        </div>

                        {/* Form Inputs */}
                        <div className="space-y-5">
                            <div className="group relative">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 group-focus-within:text-blue-500 transition-colors pointer-events-none">
                                    <UserIcon className="h-5 w-5" />
                                </div>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Full Name"
                                    className="w-full bg-neutral-50 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                    required
                                />
                            </div>

                            <div className="group relative opacity-80">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-gray-500 pointer-events-none">
                                    <Mail className="h-5 w-5" />
                                </div>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full bg-neutral-100 dark:bg-black border border-neutral-200 dark:border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-neutral-500 dark:text-neutral-400 cursor-not-allowed focus:outline-none"
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium text-neutral-400 uppercase tracking-wider bg-neutral-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                    Locked
                                </div>
                            </div>
                        </div>
                        
                        {error && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-fade-in-up">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="mt-8 group relative w-full flex items-center justify-center py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-black font-bold rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {loading ? (
                                <LoaderCircle className="h-5 w-5 animate-spin" />
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
