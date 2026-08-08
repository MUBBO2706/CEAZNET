import React from 'react';

const BookmarkListItemSkeleton: React.FC = () => {
    return (
        <div className="p-4 flex gap-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 shimmer-bg rounded-lg flex-shrink-0"></div>
            <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 shimmer-bg rounded-full"></div>
                        <div className="h-3 w-24 shimmer-bg rounded"></div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="h-4 w-full shimmer-bg rounded"></div>
                        <div className="h-4 w-4/5 shimmer-bg rounded"></div>
                    </div>
                </div>
                <div className="h-3 w-20 shimmer-bg rounded mt-1"></div>
            </div>
        </div>
    );
};

export default BookmarkListItemSkeleton;