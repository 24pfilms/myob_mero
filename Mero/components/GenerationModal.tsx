import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon, CheckIcon } from './icons';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export type ImageResolution = '1K' | '2K' | '4K';

interface GenerationModalProps {
    itemId: string;
    onClose: () => void;
    onGenerate: (itemId: string, prompt: string, type: 'image' | 'video', resolution?: ImageResolution) => Promise<void>;
}

const videoMessages = [
    "Summoning digital artists...",
    "Teaching pixels to dance...",
    "Reticulating splines...",
    "Polishing the final cut...",
    "This can take a few minutes...",
    "Grabbing a virtual coffee...",
];

export const GenerationModal: React.FC<GenerationModalProps> = ({ itemId, onClose, onGenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [type, setType] = useState<'image' | 'video'>('image');
    const [resolution, setResolution] = useState<ImageResolution>('1K');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentMessage, setCurrentMessage] = useState(videoMessages[0]);
    
    // Drag functionality
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const modalRef = useRef<HTMLDivElement>(null);

    const handleSpeechResult = (transcript: string) => {
        setPrompt(prev => prev ? `${prev.trim()} ${transcript}` : transcript.trim());
    };
    const { status, startListening, stopListening, isSupported, error: speechError } = useSpeechRecognition({ onResult: handleSpeechResult });
    const isListening = status === 'listening';
    
    useEffect(() => {
        if (speechError) {
            setError(speechError);
        }
    }, [speechError]);
    
    // Drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.modal-header')) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y,
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    useEffect(() => {
        let interval: number;
        if (isSubmitting && type === 'video') {
            interval = window.setInterval(() => {
                setCurrentMessage(prev => {
                    const currentIndex = videoMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % videoMessages.length;
                    return videoMessages[nextIndex];
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isSubmitting, type]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        stopListening();
        if (prompt.trim() && !isSubmitting) {
            setIsSubmitting(true);
            setError(null);
            
            console.log('Starting generation:', { itemId, prompt, type, resolution });
            
            try {
                await onGenerate(itemId, prompt, type, type === 'image' ? resolution : undefined);
                console.log('Generation completed successfully');
                
                setIsSubmitting(false);
                setIsSuccess(true);
                
                // Add a delay to show completion before closing
                setTimeout(() => {
                    onClose();
                }, 2000);
                
            } catch (err) {
                console.error('Generation failed:', err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred. Please try again.';
                setError(errorMessage);
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Electric backdrop */}
            <div className="absolute inset-0 bg-slate-950/95" onClick={onClose}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
            </div>
            
            {/* Modal */}
            <div 
                ref={modalRef}
                className="relative w-full max-w-lg"
                style={{
                    transform: `translate(${position.x}px, ${position.y}px)`,
                }}
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
            >
                {/* Electric glow */}
                <div className="absolute -inset-2 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 rounded-2xl opacity-60" />
                
                {/* Glass card */}
                <div 
                    className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden"
                    style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                >
                    {/* Animated top bar */}
                    <div className="h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 animate-pulse" />
                    
                    <div className="modal-header flex items-center justify-between px-6 py-4 cursor-grab active:cursor-grabbing select-none">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Generate Media</h2>
                                <p className="text-xs text-blue-400">Powered by AI</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="px-6 pb-6 border-t border-blue-500/20">
                <form onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md relative mb-4" role="alert">
                            <strong className="font-bold">Error: </strong>
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}
                    <fieldset disabled={isSubmitting}>
                        <div className="mb-4 relative mt-4">
                            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Prompt</label>
                            <textarea
                                id="prompt"
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="e.g., A cinematic shot of a cat riding a skateboard in space"
                                className="w-full h-24 p-3 pr-12 bg-slate-800/50 text-white rounded-lg border border-blue-500/30 focus:ring-2 focus:ring-cyan-500 focus:border-transparent focus:outline-none disabled:opacity-50 placeholder-gray-500"
                                required
                            />
                             {isSupported && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        isListening ? stopListening() : startListening();
                                    }}
                                    className={`absolute bottom-3 right-3 p-2 rounded-full transition-all duration-200 text-white
                                        ${ status === 'listening' ? 'bg-red-600 animate-pulse' : ''} 
                                        ${ status === 'success' ? 'bg-green-500' : ''}
                                        ${ status === 'error' ? 'bg-red-800 cursor-not-allowed' : ''}
                                        ${ status === 'idle' ? 'bg-gray-600 hover:bg-gray-500' : ''}
                                    `}
                                    title={speechError ? speechError : (isListening ? "Stop listening" : "Success!")}
                                    disabled={isSubmitting}
                                >
                                    {status === 'success' ? <CheckIcon /> : <MicrophoneIcon />}
                                </button>
                            )}
                        </div>

                        <div className="mb-4">
                            <span className="block text-sm font-medium text-gray-300 mb-2">Type</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setType('image')}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold w-full transition-all ${type === 'image' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50 border border-blue-500/20 disabled:opacity-50'}`}
                                >
                                    Image
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('video')}
                                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold w-full transition-all ${type === 'video' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50 border border-blue-500/20 disabled:opacity-50'}`}
                                >
                                    Video
                                </button>
                            </div>
                        </div>

                        {type === 'image' && (
                            <div className="mb-6">
                                <span className="block text-sm font-medium text-gray-300 mb-2">Resolution</span>
                                <div className="flex gap-2">
                                    {(['1K', '2K', '4K'] as ImageResolution[]).map((res) => (
                                        <button
                                            key={res}
                                            type="button"
                                            onClick={() => setResolution(res)}
                                            className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex-1 transition-all ${resolution === res ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-800/50 text-gray-300 hover:bg-slate-700/50 border border-blue-500/20 disabled:opacity-50'}`}
                                        >
                                            {res}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-blue-400/70 mt-2">
                                    {resolution === '1K' && '1024x1024 - Fast generation'}
                                    {resolution === '2K' && '2048x2048 - Balanced quality'}
                                    {resolution === '4K' && '4096x4096 - Highest quality'}
                                </p>
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-3 items-center min-h-[40px] pt-2">
                            {isSubmitting ? (
                                <div className="flex items-center gap-2 text-blue-400">
                                    <svg className="animate-spin h-5 w-5 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>{type === 'video' ? currentMessage : 'Generating...'}</span>
                                </div>
                            ) : isSuccess ? (
                                <div className="flex items-center gap-2 text-cyan-400">
                                    <CheckIcon />
                                    <span>Generation completed! Closing...</span>
                                </div>
                            ) : (
                                <>
                                    <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-500/40 transition-all">
                                        Generate
                                    </button>
                                </>
                            )}
                        </div>
                    </fieldset>
                </form>
                    </div>
                </div>
            </div>
        </div>
    );
};