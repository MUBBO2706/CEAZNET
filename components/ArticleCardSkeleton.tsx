
import React from 'react';

interface ArticleCardSkeletonProps {
    style: React.CSSProperties;
}

const ArticleCardSkeleton: React.FC<ArticleCardSkeletonProps> = ({ style }) => {
    return (
        <div className="absolute w-full p-4 will-change-transform" style={style}>
            {/* The background is now transparent, relying on shimmer-bg for color */}
            <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl flex flex-col bg-transparent">
                {/* Image part */}
                <div className="p-3">
                    <div className="w-full aspect-[4/3] flex-shrink-0 shimmer-bg rounded-2xl"></div>
                </div>
                {/* Text part */}
                <div className="flex-1 px-5 pb-5 flex flex-col">
                    {/* Source/Date row */}
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 shimmer-bg rounded-sm flex-shrink-0"></div>
                            <div className="h-3 w-20 shimmer-bg rounded"></div>
                        </div>
                        <div className="h-3 w-12 shimmer-bg rounded"></div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2 mt-2">
                        <div className="h-5 w-5/6 shimmer-bg rounded"></div>
                        <div className="h-5 w-3/4 shimmer-bg rounded"></div>
                    </div>
                    {/* Description */}
                    <div className="mt-3 space-y-1.5">
                        <div className="h-3 w-full shimmer-bg rounded"></div>
                        <div className="h-3 w-full shimmer-bg rounded"></div>
                        <div className="h-3 w-4/5 shimmer-bg rounded"></div>
                    </div>
                    {/* Footer */}
                    <div className="mt-auto pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Stat 1 */}
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 shimmer-bg rounded-full"></div>
                                <div className="h-4 w-8 shimmer-bg rounded"></div>
                            </div>
                            {/* Stat 2 */}
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 shimmer-bg rounded-full"></div>
                                <div className="h-4 w-8 shimmer-bg rounded"></div>
                            </div>
                        </div>
                        <div className="h-6 w-6 shimmer-bg rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArticleCardSkeleton;
