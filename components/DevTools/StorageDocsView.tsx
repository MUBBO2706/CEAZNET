import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import ReactMarkdown from 'react-markdown';

export interface StorageDocsViewProps {
    copiedId: string | null;
    handleCopy: (text: string, id: string) => void;
}

export const StorageDocsView: React.FC<StorageDocsViewProps> = ({
    copiedId,
    handleCopy
}) => {
    const [activeLang, setActiveLang] = useState<'javascript' | 'react' | 'nodejs' | 'python'>('javascript');

    const getSnippet = (lang: string) => {
        if (lang === 'react') {
            return `// React Custom Hook: useLocalStorage with reactive updates & JSON parsing
import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  // Read initial stored value or fallback
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(\`Error reading localStorage key "\${key}":\`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return wrapped version of useState's setter function
  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      const newValue = value instanceof Function ? value(storedValue) : value;
      window.localStorage.setItem(key, JSON.stringify(newValue));
      setStoredValue(newValue);
      // Dispatch storage event for other windows/tabs
      window.dispatchEvent(new Event('storage-update'));
    } catch (error) {
      console.error(\`Error setting localStorage key "\${key}":\`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}`;
        }

        if (lang === 'nodejs') {
            return `// Express / Node.js Cookie Management with Security Flags
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
app.use(cookieParser('signed-cookie-secret-key'));

// Set secure HttpOnly cookie
app.get('/api/set-session', (req, res) => {
  res.cookie('auth_session', 'token_xyz123', {
    httpOnly: true,     // Prevents XSS client-side access
    secure: true,       // Requires HTTPS
    sameSite: 'strict', // CSRF mitigation
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  });
  res.json({ success: true, message: 'Session cookie set securely' });
});

// Clear cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_session');
  res.json({ success: true });
});`;
        }

        if (lang === 'python') {
            return `# Python Selenium / Playwright Storage Inspection Automation
from playwright.sync_api import sync_playwright
import json

def inspect_client_storage():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        page.goto("https://ceaznet.vercel.app")

        # 1. Retrieve all LocalStorage entries
        local_storage = page.evaluate("() => Object.assign({}, window.localStorage)")
        print(f"LocalStorage Keys Found: {len(local_storage)}")

        # 2. Retrieve Cookies
        cookies = context.cookies()
        print(f"Active Cookies Found: {len(cookies)}")

        browser.close()

if __name__ == "__main__":
    inspect_client_storage()`;
        }

        // JavaScript / Browser default (Directly executable in Console)
        return `// Browser Storage API Recipes & Quota-Safe Utilities (Console-Ready)

// 1. Quota-Safe LocalStorage Writer
function safeSetLocalStorage(key, value) {
  try {
    const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
    window.localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.error('Storage quota exceeded! Clean stale items.');
    }
    return false;
  }
}

// 2. Read with Automatic JSON Parse
function safeGetLocalStorage(key, defaultValue = null) {
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return defaultValue;
    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch {
    return defaultValue;
  }
}

// 3. Document Cookie Helpers
function setClientCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
}

// Example Run (Safe to execute directly in Console):
safeSetLocalStorage('devtools_demo', { status: 'ok', testedAt: new Date().toLocaleTimeString() });
console.log('Read back:', safeGetLocalStorage('devtools_demo'));`;
    };

    return (
        <div className="flex-1 flex flex-col p-3 sm:p-4 md:p-5 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--dev-console-border)] text-[var(--dev-console-text)] bg-[var(--dev-console-bg)] gap-4 sm:gap-5 font-sans">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--dev-console-border)] pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <Icon icon="solar:book-linear" className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs sm:text-sm font-bold text-[var(--dev-console-text)] tracking-wider">
                            Client Storage Technical Guide & API Specs
                        </h3>
                        <p className="text-[11px] text-[var(--dev-console-text-muted)] mt-0.5">
                            Comparing LocalStorage vs SessionStorage vs Cookies, quota constraints, and implementation recipes
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 bg-[var(--dev-console-tab-bg)] p-0.5 rounded border border-[var(--dev-console-border)] overflow-x-auto">
                    {(['javascript', 'react', 'nodejs', 'python'] as const).map((lang) => (
                        <button
                            key={lang}
                            onClick={() => setActiveLang(lang)}
                            className={`px-2.5 py-1 rounded text-xs font-semibold capitalize transition-all cursor-pointer whitespace-nowrap ${
                                activeLang === lang
                                    ? 'bg-[#007fd4] text-white'
                                    : 'text-[var(--dev-console-text-muted)] hover:text-[var(--dev-console-text)]'
                            }`}
                        >
                            {lang === 'javascript' ? 'JavaScript' : lang === 'react' ? 'React Hook' : lang === 'nodejs' ? 'Node.js' : 'Python'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Code Snippet Card */}
            <div className="p-3.5 sm:p-4 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-[var(--dev-console-border)] pb-2">
                    <div className="flex items-center gap-2">
                        <Icon icon="solar:code-linear" className="w-4 h-4 text-[#007fd4]" />
                        <span className="font-bold text-xs uppercase tracking-wider text-[var(--dev-console-text)]">
                            Implementation Recipe ({activeLang.toUpperCase()})
                        </span>
                    </div>
                    <button
                        onClick={() => handleCopy(getSnippet(activeLang), `snippet-${activeLang}`)}
                        className="px-2.5 py-1 rounded text-xs bg-[var(--dev-console-bg)] hover:bg-[var(--dev-console-bg-hover)] border border-[var(--dev-console-border)] flex items-center gap-1.5 cursor-pointer text-[var(--dev-console-text)] font-semibold transition-colors"
                    >
                        {copiedId === `snippet-${activeLang}` ? <Icon icon="solar:check-circle-linear" className="w-3.5 h-3.5 text-green-500" /> : <Icon icon="solar:copy-linear" className="w-3.5 h-3.5" />}
                        <span>Copy Code</span>
                    </button>
                </div>

                <pre className="p-3 sm:p-4 rounded bg-[var(--dev-payload-code-bg)] border border-[var(--dev-payload-code-border)] font-mono text-xs text-[var(--dev-console-text)] overflow-x-auto leading-relaxed whitespace-pre select-all">
                    {getSnippet(activeLang)}
                </pre>
            </div>

            {/* Comparison Matrix */}
            <div className="p-3.5 sm:p-4 rounded border border-[var(--dev-console-border)] bg-[var(--dev-console-tab-bg)] flex flex-col gap-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--dev-console-text)] flex items-center gap-1.5 border-b border-[var(--dev-console-border)] pb-2">
                    <Icon icon="solar:layers-minimalistic-linear" className="w-4 h-4 text-purple-500" />
                    Storage Engine Comparison Matrix
                </h4>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                        <thead>
                            <tr className="border-b border-[var(--dev-console-border)] text-[var(--dev-console-text-muted)] text-[10px] uppercase">
                                <th className="py-2 px-2.5">Feature</th>
                                <th className="py-2 px-2.5">Local Storage</th>
                                <th className="py-2 px-2.5">Session Storage</th>
                                <th className="py-2 px-2.5">Cookies</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--dev-console-border-light)]">
                            <tr>
                                <td className="py-2.5 px-2.5 font-semibold text-[var(--dev-console-text)]">Typical Capacity</td>
                                <td className="py-2.5 px-2.5 text-[#007fd4] font-bold">~5 MB per origin</td>
                                <td className="py-2.5 px-2.5 text-purple-600 dark:text-purple-400 font-bold">~5 MB per origin</td>
                                <td className="py-2.5 px-2.5 text-amber-600 dark:text-amber-400 font-bold">~4 KB per cookie</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-2.5 font-semibold text-[var(--dev-console-text)]">Persistence</td>
                                <td className="py-2.5 px-2.5">Persistent until explicit clear</td>
                                <td className="py-2.5 px-2.5">Cleared on tab close</td>
                                <td className="py-2.5 px-2.5">Configurable via Expires / Max-Age</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-2.5 font-semibold text-[var(--dev-console-text)]">Network Overhead</td>
                                <td className="py-2.5 px-2.5">Never sent with HTTP requests</td>
                                <td className="py-2.5 px-2.5">Never sent with HTTP requests</td>
                                <td className="py-2.5 px-2.5 text-amber-600 dark:text-amber-400">Sent on every matching HTTP request</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-2.5 font-semibold text-[var(--dev-console-text)]">Accessibility</td>
                                <td className="py-2.5 px-2.5">Client JS only</td>
                                <td className="py-2.5 px-2.5">Client JS only (same tab)</td>
                                <td className="py-2.5 px-2.5">Client JS (unless HttpOnly set) & Server</td>
                            </tr>
                            <tr>
                                <td className="py-2.5 px-2.5 font-semibold text-[var(--dev-console-text)]">Security (XSS / CSRF)</td>
                                <td className="py-2.5 px-2.5">Vulnerable to XSS</td>
                                <td className="py-2.5 px-2.5">Vulnerable to XSS</td>
                                <td className="py-2.5 px-2.5">Protected against XSS with HttpOnly; SameSite mitigates CSRF</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
