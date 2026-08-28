import React, { useState } from 'react';

interface YouTubeModalProps {
    onClose: () => void;
    onAdd: (url: string) => void;
}

export const YouTubeModal: React.FC<YouTubeModalProps> = ({ onClose, onAdd }) => {
    const [url, setUrl] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (url.trim()) {
            onAdd(url);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Electric backdrop */}
            <div className="absolute inset-0 bg-slate-950/95" onClick={onClose}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
            </div>
            
            {/* Modal */}
            <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
                {/* Electric glow */}
                <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
                
                {/* Glass card */}
                <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden">
                    {/* Animated top bar */}
                    <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
                    
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Embed YouTube</h2>
                                <p className="text-xs text-blue-400">Add video to canvas</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleSubmit}>
                            <div className="mb-6">
                                <label htmlFor="youtube-url" className="block text-sm font-medium text-gray-300 mb-2">YouTube URL</label>
                                <input
                                    id="youtube-url"
                                    type="text"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="e.g., https://www.youtube.com/watch?v=..."
                                    className="w-full p-3 bg-slate-800/50 text-white rounded-lg border border-blue-500/30 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none placeholder-gray-500"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/40 transition-all">
                                    Add Video
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};