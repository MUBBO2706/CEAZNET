import React from 'react';

const MoleculeViewerSkeleton: React.FC = () => {
    return (
        <div className="bg-neutral-100 dark:bg-gray-800/50 rounded-lg my-4 border border-neutral-200 dark:border-gray-700 overflow-hidden shadow-md animate-pulse">
            {/* 3D Viewer Area */}
            <div className="w-full aspect-video shimmer-bg"></div>
            
            {/* Details Section (Accordion Header) */}
            <div className="p-3 border-t border-neutral-200 dark:border-gray-700">
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <div className="h-5 w-2/3 shimmer-bg rounded-md mb-2"></div>
                        <div className="flex items-center gap-4 mt-1">
                            <div className="h-3 w-1/4 shimmer-bg rounded-md"></div>
                            <div className="h-3 w-1/3 shimmer-bg rounded-md"></div>
                        </div>
                    </div>
                    {/* Placeholder for the chevron icon */}
                    <div className="h-5 w-5 shimmer-bg rounded-full"></div>
                </div>
            </div>
        </div>
    );
};

export default MoleculeViewerSkeleton;