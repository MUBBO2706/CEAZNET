
export const stripMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  // This regex removes markdown syntax for bold, italics, headers, lists, and citations.
  return markdown
    .replace(/^#+\s/gm, '') // Headers
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // Italics
    .replace(/^\s*[-*]\s+/gm, '') // Unordered list items
    .replace(/^\s*\d+\.\s+/gm, '') // Ordered list items
    .replace(/\[\d+\]/g, '') // Citations
    .replace(/```[\s\S]*?```/g, '[Code Block]') // Code blocks
    .trim();
};

export const formatTimeAgo = (isoDateString?: string): string => {
    if (!isoDateString) return '';

    const now = new Date();
    const date = new Date(isoDateString);
    // Use Math.max to prevent negative numbers due to slight clock drift
    const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (seconds < 10) return 'Just now';
    
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(seconds / 3600);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(seconds / 86400);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(seconds / 604800);
    if (weeks < 5) return `${weeks}w ago`;

    const months = Math.floor(seconds / 2629800); // Approximation
    if (months < 12) return `${months}mo ago`;
    
    const years = Math.floor(seconds / 31557600); // Approximation
    return `${years}y ago`;
};

export const formatStat = (num?: number): string => {
    if (num === undefined || num === null) return '0';
    if (num < 1000) return num.toString();
    if (num < 1000000) return `${(num / 1000).toFixed(1)}k`;
    return `${(num / 1000000).toFixed(1)}m`;
};
