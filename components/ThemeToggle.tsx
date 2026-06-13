
import React, { useState, useEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
    isCollapsed?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ isCollapsed = false }) => {
    const [isDark, setIsDark] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            return savedTheme === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        const root = document.documentElement;
        const lightHljs = document.getElementById('hljs-light-theme');
        const darkHljs = document.getElementById('hljs-dark-theme');

        root.classList.toggle('dark', isDark);
        lightHljs?.toggleAttribute('disabled', isDark);
        darkHljs?.toggleAttribute('disabled', !isDark);
    }, [isDark]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        const handleChange = (e: MediaQueryListEvent) => {
            if (localStorage.getItem('theme') === null) {
                setIsDark(e.matches);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const toggleTheme = useCallback(() => {
        setIsDark(prev => {
            const newIsDark = !prev;
            localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
            return newIsDark;
        });
    }, []);

    // Optimized layout for the new Sidebar
    return (
        <button
            onClick={toggleTheme}
            className={`
                relative flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ease-in-out focus:outline-none 
                ${isCollapsed 
                    ? 'w-10 h-6' // Compact vertical layout
                    : 'w-14 h-8' // Wider layout for expanded sidebar
                } 
                ${isDark 
                    ? 'bg-slate-700 ring-1 ring-slate-600 shadow-inner' 
                    : 'bg-sky-100 ring-1 ring-sky-200 shadow-inner'
                }
            `}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
            <div
                className={`
                    absolute bg-white dark:bg-slate-200 rounded-full shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center
                    ${isCollapsed 
                        ? 'w-4 h-4' 
                        : 'w-6 h-6'
                    }
                `}
                style={{ 
                    transform: isDark 
                        ? `translateX(${isCollapsed ? '1rem' : '1.5rem'})` 
                        : 'translateX(0)' 
                }}
            >
                {/* Icons inside the slider thumb for a premium touch */}
                {isDark ? (
                    <Moon className={`text-slate-800 ${isCollapsed ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} strokeWidth={2.5} />
                ) : (
                    <Sun className={`text-amber-500 ${isCollapsed ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} strokeWidth={2.5} />
                )}
            </div>
        </button>
    );
};

export default ThemeToggle;
