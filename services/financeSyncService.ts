
import { Transaction, Note } from '../types';
import { getNotes, saveNote, getTransactions, getFinanceProfiles } from './dbService';
import { User } from '@supabase/supabase-js';

const LINK_TAG_PREFIX = 'wallet:';

/**
 * Helper to get the specific tag string for a wallet profile.
 */
const getWalletTag = (profileId: string | undefined | null) => {
    return `${LINK_TAG_PREFIX}${profileId || 'default'}`;
};

/**
 * Links a wallet (profile) to a specific note ID by adding a special tag to the note.
 * Removes the tag from any other notes to ensure a 1:1 mapping for this wallet.
 */
export const linkWalletToNote = async (user: User | null, profileId: string | null, note: Note) => {
    const targetTag = getWalletTag(profileId);
    const allNotes = await getNotes(user);

    // 1. Remove this wallet tag from ANY other notes to ensure uniqueness
    const oldLinkedNotes = allNotes.filter(n => n.tags?.includes(targetTag) && n.id !== note.id);
    
    for (const oldNote of oldLinkedNotes) {
        const newTags = (oldNote.tags || []).filter(t => t !== targetTag);
        await saveNote({ ...oldNote, tags: newTags, updatedAt: new Date().toISOString() }, user);
    }

    // 2. Add the tag to the target note if not present
    if (!note.tags?.includes(targetTag)) {
        const newTags = [...(note.tags || []), targetTag];
        await saveNote({ ...note, tags: newTags, updatedAt: new Date().toISOString() }, user);
    }
};

/**
 * Fetch the actual Note object linked to the current profile by looking for the tag.
 */
export const fetchLinkedNote = async (user: User | null, profileId: string | undefined | null): Promise<Note | undefined> => {
    const targetTag = getWalletTag(profileId);
    const allNotes = await getNotes(user);
    
    const candidates = allNotes.filter(n => n.tags?.includes(targetTag));
    return candidates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
};

// --- NATURAL LANGUAGE GENERATION ---

const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

const cleanText = (str: string) => {
    if (!str) return '';
    return str.replace(/[*_`\[\]~]/g, '').trim();
};

/**
 * Generates a structured, natural language line for the note.
 */
const generateLogLine = (t: Transaction): string => {
    const dateObj = new Date(t.transaction_date);
    const timeStr = dateObj.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    }).replace(/\s+/g, ' ').trim();

    // Dynamic Styles
    let amountClass = 'text-gray-900 dark:text-gray-100';
    let iconClass = 'fi-expense text-gray-500'; // Default
    
    // Category Code-Pill Styles
    let catBg = 'bg-gray-100 dark:bg-gray-800';
    let catText = 'text-gray-700 dark:text-gray-300';
    let catBorder = 'border-gray-200 dark:border-gray-700';
    
    if (t.type === 'income') {
        amountClass = 'text-emerald-600 dark:text-emerald-400';
        iconClass = 'fi-income text-emerald-500';
        
        catBg = 'bg-emerald-100 dark:bg-emerald-900/40';
        catText = 'text-emerald-800 dark:text-emerald-300';
        catBorder = 'border-emerald-200 dark:border-emerald-800/50';
        
    } else if (t.type === 'expense') {
        amountClass = 'text-rose-600 dark:text-rose-400';
        iconClass = 'fi-expense text-rose-500';
        
        catBg = 'bg-rose-100 dark:bg-rose-900/40';
        catText = 'text-rose-800 dark:text-rose-300';
        catBorder = 'border-rose-200 dark:border-rose-800/50';
        
    } else {
        amountClass = 'text-indigo-600 dark:text-indigo-400';
        iconClass = 'fi-transfer text-indigo-500';
        
        catBg = 'bg-indigo-100 dark:bg-indigo-900/40';
        catText = 'text-indigo-800 dark:text-indigo-300';
        catBorder = 'border-indigo-200 dark:border-indigo-800/50';
    }

    const iconHtml = `<span class="f-icon ${iconClass}"></span>`;
    
    // Styled Components for Markdown
    const amountHtml = `<span class="${amountClass} font-mono font-bold tracking-tight">${formatCurrency(t.amount)}</span>`;
    const timeHtml = `<span class="text-[10px] text-gray-400 dark:text-gray-500 font-mono ml-2 opacity-60">${timeStr}</span>`;
    
    // Updated Category HTML to mimic code block/pill style with specific colors
    const categoryHtml = `<span class="px-1.5 py-0.5 rounded-[4px] text-[11px] font-mono font-bold tracking-wide border ${catBorder} ${catBg} ${catText}">${cleanText(t.category)}</span>`;
    
    // Description in muted styling
    const descriptionClean = cleanText(t.description || '');
    let descHtml = '';
    
    if (descriptionClean && descriptionClean.toLowerCase() !== t.category.toLowerCase()) {
        descHtml = ` <span class="text-gray-500 dark:text-gray-400 text-xs">— ${descriptionClean}</span>`;
    }
    
    // High value alert
    const isHighValue = t.amount >= 5000;
    const alert = isHighValue ? '<span class="f-icon fi-alert text-amber-500"></span> ' : '';

    return `- ${alert}${iconHtml} ${categoryHtml} &nbsp;${amountHtml} ${descHtml} ${timeHtml} <!-- tx_id:${t.id} ts:${dateObj.getTime()} -->`;
};

// Return a CLEAN DATE STRING (e.g. "Monday, Oct 24, 2023") for grouping
const getDateString = (isoDate: string): string => {
    const dateObj = new Date(isoDate);
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    return dateObj.toLocaleDateString('en-US', options);
}

// Generates the visual HTML Header for a date
const generateDateHeaderHtml = (dateStr: string): string => {
    // Uses HTML h3 with specific margins to avoid extra whitespace
    // Reduced mt-5 to mt-4 to tighten spacing further
    return `<h3 class="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200 mt-4 mb-2"><span class="f-icon fi-calendar text-gray-500"></span> ${dateStr}</h3>`;
};

const parseLineStats = (line: string) => {
    const amountMatch = line.match(/₹([\d,]+)/);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;
    
    let type: 'income' | 'expense' | 'transfer' | 'unknown' = 'unknown';
    // Check for specific icon classes in the HTML string
    if (line.includes('fi-income')) type = 'income';
    else if (line.includes('fi-expense')) type = 'expense';
    else if (line.includes('fi-transfer')) type = 'transfer';
    // Fallback for backward compatibility with emojis
    else if (line.includes('💰')) type = 'income';
    else if (line.includes('💸')) type = 'expense';
    else if (line.includes('🔄')) type = 'transfer';

    return { type, amount };
};

const generateFooterStats = (txLines: string[]): string => {
    let income = 0;
    let expense = 0;

    txLines.forEach(line => {
        const { type, amount } = parseLineStats(line);
        if (type === 'income') income += amount;
        if (type === 'expense') expense += amount;
    });

    if (income === 0 && expense === 0) return '';

    const balance = income - expense;
    const sign = balance >= 0 ? '+' : '-';
    
    const incomePart = `<span class="f-icon fi-income text-emerald-500"></span> <span class="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">₹${income.toLocaleString('en-IN')}</span>`;
    const expensePart = `<span class="f-icon fi-expense text-rose-500"></span> <span class="text-rose-600 dark:text-rose-400 font-mono font-bold text-xs">₹${expense.toLocaleString('en-IN')}</span>`;
    const balancePart = `<span class="f-icon fi-wallet text-gray-800 dark:text-gray-200"></span> <span class="text-gray-900 dark:text-white font-mono font-extrabold text-xs">${sign}₹${Math.abs(balance).toLocaleString('en-IN')}</span>`;
    
    // Structured Blockquote Footer with Small, Normal Font. Wrapped in not-italic to override blockquote default.
    return `> <span class="not-italic"><span class="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Daily Total</span> &nbsp; ${incomePart} &nbsp;<span class="text-gray-300 dark:text-gray-600 text-[10px]">|</span>&nbsp; ${expensePart} &nbsp;<span class="text-gray-300 dark:text-gray-600 text-[10px]">|</span>&nbsp; ${balancePart}</span> <!-- daily_stats -->`;
};

/**
 * Generates the "Final Verdict" card for the day.
 * MINIFIED to prevent extra lines in Markdown rendering.
 */
const generateDailyVerdict = (txs: Transaction[]): string => {
    let income = 0;
    let expense = 0;
    const catTotals: Record<string, number> = {};

    txs.forEach(t => {
        const amt = Number(t.amount);
        if (t.type === 'income') income += amt;
        if (t.type === 'expense') {
            expense += amt;
            catTotals[t.category] = (catTotals[t.category] || 0) + amt;
        }
    });

    if (income === 0 && expense === 0) return '';

    // Determine Top Category
    const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCatName = topCategory ? topCategory[0] : 'None';
    const topCatAmount = topCategory ? topCategory[1] : 0;

    // Determine Sentiment
    let verdictTitle = "Balanced Day";
    let verdictColor = "text-blue-600 dark:text-blue-400";
    let verdictBg = "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20";
    let iconClass = "fi-wallet";

    if (income > expense * 1.5) {
        verdictTitle = "Savings Day";
        verdictColor = "text-emerald-600 dark:text-emerald-400";
        verdictBg = "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20";
        iconClass = "fi-income";
    } else if (expense > income && income > 0) {
        verdictTitle = "High Spend";
        verdictColor = "text-rose-600 dark:text-rose-400";
        verdictBg = "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/20";
        iconClass = "fi-expense";
    } else if (expense > 2000) {
        verdictTitle = "Heavy Expenses";
        verdictColor = "text-orange-600 dark:text-orange-400";
        verdictBg = "bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/20";
        iconClass = "fi-alert";
    }

    const topCatHtml = topCatAmount > 0 
        ? `<div class="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1"><span class="uppercase font-bold tracking-wider opacity-70">Top:</span><span class="font-bold text-gray-700 dark:text-gray-300">${topCatName}</span><span class="font-mono opacity-80">(₹${topCatAmount.toLocaleString('en-IN')})</span></div>`
        : '';

    // Generate HTML Card - Minified to remove whitespace issues in markdown rendering
    return `<!-- daily_verdict_start --><div class="mt-2 p-3 rounded-xl border flex items-center justify-between ${verdictBg}"><div class="flex items-center gap-2"><span class="f-icon ${iconClass} ${verdictColor}"></span><span class="text-xs font-bold ${verdictColor}">${verdictTitle}</span></div>${topCatHtml}</div><!-- daily_verdict_end -->`;
};

/**
 * Generates a Dashboard Snapshot header for the top of the note as a Markdown Table.
 */
const generateSnapshotHeader = (transactions: Transaction[], profileName: string) => {
    let income = 0;
    let expense = 0;
    let highestTx = 0;
    const catTotals: Record<string, number> = {};
    
    transactions.forEach(t => {
        const amt = Number(t.amount);
        if (amt > highestTx) highestTx = amt;
        
        if (t.type === 'income') income += amt;
        if (t.type === 'expense') {
            expense += amt;
            catTotals[t.category] = (catTotals[t.category] || 0) + amt;
        }
    });
    
    const balance = income - expense;
    const sign = balance >= 0 ? '+' : '-';
    const dateStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    // --- Insights Calculations ---
    const sortedCats = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5); // Top 5 Categories

    // Savings Rate Calculation
    let savingsRate = 0;
    if (income > 0) {
        savingsRate = ((income - expense) / income) * 100;
    }
    
    // Avg Transaction Calculation
    const expenseTxCount = transactions.filter(t => t.type === 'expense').length;
    const avgTx = expenseTxCount > 0 ? (expense / expenseTxCount) : 0;
    const dailyAvg = expense / 30; // Approx

    // --- GENERATE WIDGETS ---

    // 1. Expense Breakdown Card (Styled HTML Card)
    // ADDED MARGIN BOTTOM (mb-6) to spacing
    const breakdownColors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'];
    let breakdownContent = "";
    
    if (sortedCats.length === 0) {
        breakdownContent = `<p class="text-xs text-gray-400 italic text-center py-2">No expenses recorded yet</p>`;
    } else {
        breakdownContent = sortedCats.map(([cat, amount], i) => {
            const percent = expense > 0 ? ((amount / expense) * 100).toFixed(1) : "0";
            const color = breakdownColors[i % breakdownColors.length];
            return `<div class="mb-2 last:mb-0">` +
                `<div class="flex justify-between items-end mb-1">` +
                    `<span class="text-xs font-semibold text-gray-700 dark:text-gray-300">${cat}</span>` +
                    `<div class="text-right font-mono"><span class="text-xs font-bold text-gray-900 dark:text-white">₹${amount.toLocaleString('en-IN')}</span> <span class="text-[10px] text-gray-400 ml-1">${percent}%</span></div>` +
                `</div>` +
                `<div class="h-1.5 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden">` +
                    `<div class="h-full rounded-full ${color}" style="width: ${percent}%"></div>` +
                `</div>` +
            `</div>`;
        }).join('');
    }

    const expenseBreakdownCard = `<!-- FINANCE_WIDGET_START --><div class="p-4 bg-white dark:bg-[#1e1f22] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6">` +
        `<div class="flex items-center gap-2 mb-3"><span class="f-icon fi-expense text-rose-500"></span><span class="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Expense Breakdown</span></div>` +
        breakdownContent +
    `</div><!-- FINANCE_WIDGET_END -->`;

    // 2. 4-Grid Stats Cards HTML (Minified string)
    // ADDED MARGIN BOTTOM (mb-6) to spacing
    const statsCards = `<!-- FINANCE_WIDGET_START --><div class="grid grid-cols-2 gap-2 items-stretch mb-6">` +
        `<div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col justify-between">` +
            `<div class="flex items-center gap-1.5 mb-1 opacity-70"><span class="f-icon fi-income text-emerald-500"></span><span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Income</span></div>` +
            `<div class="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-400">₹${income.toLocaleString('en-IN')}</div>` +
        `</div>` +
        `<div class="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex flex-col justify-between">` +
            `<div class="flex items-center gap-1.5 mb-1 opacity-70"><span class="f-icon fi-expense text-rose-500"></span><span class="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Expense</span></div>` +
            `<div class="text-lg font-mono font-bold text-rose-700 dark:text-rose-400">₹${expense.toLocaleString('en-IN')}</div>` +
        `</div>` +
        `<div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col justify-between">` +
            `<div class="flex items-center gap-1.5 mb-1 opacity-70"><span class="f-icon fi-wallet text-gray-500"></span><span class="text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Net Flow</span></div>` +
            `<div class="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">${sign}₹${Math.abs(balance).toLocaleString('en-IN')}</div>` +
        `</div>` +
        `<div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col justify-between">` +
            `<div class="flex items-center gap-1.5 mb-1 opacity-70"><span class="f-icon fi-alert text-blue-500"></span><span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Saved</span></div>` +
            `<div class="text-lg font-mono font-bold text-blue-700 dark:text-blue-400">${savingsRate.toFixed(1)}%</div>` +
        `</div>` +
    `</div><!-- FINANCE_WIDGET_END -->`;

    // 3. 4-Grid Insights HTML (Minified)
    // ADDED MARGIN BOTTOM (mb-6) to spacing
    const insightsGrid = `<!-- FINANCE_WIDGET_START --><div class="grid grid-cols-2 gap-2 mt-0 items-stretch mb-6">` +
        `<div class="p-2.5 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 flex flex-col gap-1">` +
            `<div class="flex items-center gap-1.5 opacity-80"><span class="f-icon fi-transfer text-indigo-500"></span><span class="text-[9px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Tx Volume</span></div>` +
            `<div class="text-sm font-bold text-indigo-900 dark:text-indigo-200">${transactions.length} <span class="text-[10px] font-normal opacity-60">count</span></div>` +
        `</div>` +
        `<div class="p-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-900/30 flex flex-col gap-1">` +
            `<div class="flex items-center gap-1.5 opacity-80"><span class="f-icon fi-calendar text-amber-500"></span><span class="text-[9px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Daily Avg</span></div>` +
            `<div class="text-sm font-bold text-amber-900 dark:text-amber-200">₹${dailyAvg.toFixed(0)} <span class="text-[10px] font-normal opacity-60">/day</span></div>` +
        `</div>` +
        `<div class="p-2.5 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30 flex flex-col gap-1">` +
            `<div class="flex items-center gap-1.5 opacity-80"><span class="f-icon fi-expense text-rose-500"></span><span class="text-[9px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Highest</span></div>` +
            `<div class="text-sm font-bold text-rose-900 dark:text-rose-200">₹${highestTx.toLocaleString('en-IN')}</div>` +
        `</div>` +
        `<div class="p-2.5 bg-teal-50 dark:bg-teal-900/10 rounded-xl border border-teal-100 dark:border-teal-900/30 flex flex-col gap-1">` +
            `<div class="flex items-center gap-1.5 opacity-80"><span class="f-icon fi-alert text-teal-500"></span><span class="text-[9px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">Tx Avg</span></div>` +
            `<div class="text-sm font-bold text-teal-900 dark:text-teal-200">₹${avgTx.toFixed(0)}</div>` +
        `</div>` +
    `</div><!-- FINANCE_WIDGET_END -->`;

    // Construct the string with minimal newlines to control spacing perfectly
    return `<h1 class="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2"><span class="f-icon fi-wallet text-indigo-500"></span> ${profileName} Report</h1>` +
        statsCards +
        expenseBreakdownCard + 
        insightsGrid +
        `<div class="flex justify-between items-center mt-2 mb-0"><span class="text-[10px] text-gray-400">Last Synced: ${dateStr}</span></div>` +
        `<hr class="my-1 border-gray-200 dark:border-gray-800" />`;
};

// --- CONTENT MANIPULATION LOGIC ---

/**
 * Robustly rebuilds the note content.
 * 1. Preserves manual user text.
 * 2. Removes stale transaction lines and old stats.
 * 3. Re-inserts ALL current transactions in correct order.
 * 4. Places Daily Stats at the BOTTOM of each date block.
 * 5. Updates Snapshot Header table.
 */
const rebuildNoteContent = (transactions: Transaction[], profileName: string): string => {
    // 1. Group Transactions by Date String Key
    const groupedTxs: Record<string, Transaction[]> = {};
    transactions.forEach(t => {
        const headerKey = getDateString(t.transaction_date);
        if (!groupedTxs[headerKey]) groupedTxs[headerKey] = [];
        groupedTxs[headerKey].push(t);
    });

    // 2. Build New Content
    let newContent = generateSnapshotHeader(transactions, profileName); 

    // Get all unique date keys from DB transactions
    const allHeaders = new Set(Object.keys(groupedTxs));
    
    // Sort keys DESCENDING (Newest date first)
    const sortedHeaders = Array.from(allHeaders).sort((a, b) => {
        const dateA = new Date(a); 
        const dateB = new Date(b);
        return dateB.getTime() - dateA.getTime(); 
    });

    sortedHeaders.forEach((headerKey, index) => {
        const txs = groupedTxs[headerKey] || [];
        
        // Add HTML Header for this day
        newContent += `\n${generateDateHeaderHtml(headerKey)}\n`;
        
        // Add Transactions (Sorted by time descending)
        const txLines = txs
            .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
            .map(generateLogLine);

        if (txLines.length > 0) {
            newContent += txLines.join('\n') + '\n';
        }
        
        // Add Footer Stats
        if (txLines.length > 0) {
             const footer = generateFooterStats(txLines);
             if (footer) newContent += footer + '\n';
             
             // NEW: Add Verdict after footer
             const verdict = generateDailyVerdict(txs);
             if (verdict) newContent += verdict + '\n';
        }
        
        // Add Separator if not last
        if (index < sortedHeaders.length - 1) {
            newContent += '---\n';
        }
    });

    return newContent.trim();
};

/**
 * Helper to get wallet name quickly if not provided
 */
const getProfileName = async (user: User | null, profileId: string | null | undefined): Promise<string> => {
    if (!profileId) return 'Main Wallet';
    const profiles = await getFinanceProfiles(user);
    const p = profiles.find(pr => pr.id === profileId);
    return p ? p.name : 'Wallet';
}

// --- PUBLIC API ---

export const syncAllTransactionsToNote = async (user: User | null, profileId: string | null, profileName: string): Promise<boolean> => {
    try {
        const note = await fetchLinkedNote(user, profileId);
        if (!note) return false;

        // Fetch ALL transactions for this profile
        const allTransactions = await getTransactions(user, profileId);
        
        // Rebuild entire note content
        const newContent = rebuildNoteContent(allTransactions, profileName);
        
        await saveNote({ ...note, content: newContent, updatedAt: new Date().toISOString() }, user);
        return true;
    } catch (e) {
        console.error("Sync All Failed", e);
        return false;
    }
};

export const syncTransactionAdd = async (user: User | null, transaction: Transaction): Promise<boolean> => {
    const profileName = await getProfileName(user, transaction.profile_id);
    return syncAllTransactionsToNote(user, transaction.profile_id || null, profileName);
};

export const syncTransactionDelete = async (user: User | null, transactionId: string, profileId: string | undefined | null): Promise<boolean> => {
    const profileName = await getProfileName(user, profileId);
    return syncAllTransactionsToNote(user, profileId || null, profileName);
};

export const syncTransactionUpdate = async (user: User | null, transaction: Transaction): Promise<boolean> => {
    const profileName = await getProfileName(user, transaction.profile_id);
    return syncAllTransactionsToNote(user, transaction.profile_id || null, profileName);
};
