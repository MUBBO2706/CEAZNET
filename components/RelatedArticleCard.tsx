import React, { useMemo } from 'react';
import { NewsArticle } from '../types';
import { formatTimeAgo, formatStat } from '../utils/stringUtils';
import { Eye } from 'lucide-react';
import { useDynamicColors } from '../hooks/useDynamicColors';
import { useCachedImage } from '../services/imageCachingService';

interface RelatedArticleCardProps {
    article: NewsArticle;
    onClick: () => void;
}

const Skeleton: React.FC = () => (
    <div className="flex-shrink-0 w-56 rounded-xl p-3 flex flex-col gap-3">
        <div className="relative w-full h-28 rounded-lg shimmer-bg flex-shrink-0">
             <div className="absolute bottom-2 left-2 h-4 w-16 rounded-full shimmer-bg" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
            <div>
                <div className="flex items-center mb-1">
                    <div className="w-4 h-4 rounded-sm mr-2 shimmer-bg" />
                    <div className="h-3 w-20 rounded shimmer-bg" />
                </div>
                <div className="space-y-1.5 mt-2">
                    <div className="h-3 w-full rounded shimmer-bg" />
                    <div className="h-3 w-4/5 rounded shimmer-bg" />
                </div>
            </div>
            <div className="flex justify-between items-center mt-2">
                <div className="h-3 w-12 rounded shimmer-bg" />
                <div className="h-3 w-8 rounded shimmer-bg" />
            </div>
        </div>
    </div>
);


const RelatedArticleCard: React.FC<RelatedArticleCardProps> = ({ article, onClick }) => {
    const { colors, isLoading } = useDynamicColors(article.image || null);
    const cachedImage = useCachedImage(article.image || null);

    const hostname = useMemo(() => {
        try {
            return new URL(article.url).hostname.replace(/^www\./, '');
        } catch {
            return article.source.name || 'news';
        }
    }, [article.url, article.source.name]);

    if (isLoading) {
        return <Skeleton />;
    }

    return (
        <button
            onClick={onClick}
            style={{ background: colors.background }}
            className="flex-shrink-0 w-56 text-left rounded-xl p-3 flex flex-col gap-3 hover:brightness-110 transition-all duration-300 border border-black/10 dark:border-white/10 shadow-lg"
        >
            <div className="relative w-full h-28 rounded-lg overflow-hidden flex-shrink-0">
                <img
                    src={cachedImage || ''}
                    alt={article.title}
                    className="w-full h-full object-cover bg-neutral-800"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto-format&fit=crop'; }}
                />
                {article.category && (
                     <div
                        className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-sm rounded-full text-white text-[10px] font-bold uppercase tracking-wider"
                    >
                        {article.category}
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                    <div className="flex items-center text-xs mb-1" style={{ color: colors.subText }}>
                        <img
                            src={`https://icons.duckduckgo.com/ip3/${hostname}.ico`}
                            alt={`${hostname} favicon`}
                            className="w-4 h-4 rounded-sm mr-2 flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <span className="truncate">{article.source.name}</span>
                    </div>
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: colors.text }}>
                        {article.title}
                    </h3>
                </div>
                <div className="flex justify-between items-center text-xs mt-2" style={{ color: colors.subText }}>
                    <span>{formatTimeAgo(article.publishedAt)}</span>
                    <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{formatStat(article.views)}</span>
                    </div>
                </div>
            </div>
        </button>
    );
};

export default RelatedArticleCard;