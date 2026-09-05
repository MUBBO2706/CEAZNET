import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle } from 'lucide-react';

interface SuspendedInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SuspendedInfoModal: React.FC<SuspendedInfoModalProps> = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    const prefilledMessage = encodeURIComponent("Hi Team,\n\nI am writing to appeal the suspension of my account. I believe this might be an error or a misunderstanding regarding the Terms of Service. Could you please review my account and provide more details on the reason for this suspension?\n\nThank you,");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-hidden">
            <div 
                ref={modalRef}
                className="bg-white dark:bg-[#0B0D14] border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-full"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800/50">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                        <h2 className="font-semibold text-gray-900 dark:text-white">Account Suspended</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-4 leading-relaxed">
                        Your account has been suspended due to a violation of our{' '}
                        <button 
                            onClick={() => {
                                onClose();
                                navigate('/terms-of-service');
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none inline"
                        >
                            Terms of Service
                        </button>{' '}
                        or unusual security activity detected. While your account is suspended, you are placed in <strong>Read-Only Mode</strong>.
                    </p>
                    
                    <div className="mb-6">
                        <h3 className="text-gray-900 dark:text-white font-medium text-sm mb-3">What this means:</h3>
                        <ul className="list-disc pl-5 text-gray-600 dark:text-gray-400 text-sm space-y-2">
                            <li>You <strong className="text-gray-900 dark:text-gray-200">cannot</strong> create new content, items, or records.</li>
                            <li>You <strong className="text-gray-900 dark:text-gray-200">cannot</strong> update or modify any existing data.</li>
                            <li>You <strong className="text-gray-900 dark:text-gray-200">can still</strong> view your existing dashboards, data, and read available content.</li>
                        </ul>
                    </div>

                    <p className="text-gray-700 dark:text-gray-300 text-sm mb-6 leading-relaxed">
                        This action is taken to protect platform integrity. If you believe this suspension is an error, please reach out to our support team for a review.
                    </p>
                    
                    <div className="flex pt-4 border-t border-gray-100 dark:border-gray-800/50">
                        <button 
                            onClick={() => {
                                onClose();
                                navigate(`/support?guest=true&topic=Account%20Suspension%20Appeal&message=${prefilledMessage}`);
                            }}
                            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors border border-transparent shadow-sm"
                        >
                            Contact Support
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
