import { useState, useRef, useEffect, useCallback } from 'react';

// FIX: Add type definitions for the Web Speech API to resolve "Cannot find name 'SpeechRecognition'".
// These interfaces are typically provided by browser DOM typings but are included here for compatibility.
interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
}

interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean;
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    start(): void;
    stop(): void;
    abort(): void;
}

// Browser compatibility check for the Web Speech API
const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognitionIsSupported = !!SpeechRecognitionAPI;

type RecognitionStatus = 'idle' | 'listening' | 'success' | 'error';

interface SpeechRecognitionOptions {
    onResult: (transcript: string) => void;
}

export const useSpeechRecognition = ({ onResult }: SpeechRecognitionOptions) => {
    const [status, _setStatus] = useState<RecognitionStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const hadResultInSession = useRef(false);
    const manuallyStopped = useRef(false);
    
    // Ref to hold the current status to avoid stale closures in event handlers
    const statusRef = useRef(status);
    const setStatus = (s: RecognitionStatus) => {
        statusRef.current = s;
        _setStatus(s);
    }

    const onResultRef = useRef(onResult);
    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        if (!recognitionIsSupported) {
            setError("Speech recognition is not supported in this browser.");
            setStatus('error');
            return;
        }

        const recognition: SpeechRecognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                hadResultInSession.current = true;
                onResultRef.current(finalTranscript.trim());
            }
        };

        recognition.onstart = () => {
            setError(null);
            setStatus('listening');
        };
        
        recognition.onend = () => {
             // If the user manually stopped, or if we are no longer in 'listening' state (e.g. due to an error),
             // then we transition to the final state.
             if (manuallyStopped.current || statusRef.current !== 'listening') {
                 const success = hadResultInSession.current;
                 hadResultInSession.current = false;

                 if (success) {
                     setStatus('success');
                     setTimeout(() => setStatus('idle'), 1200);
                 } else {
                     setStatus('idle');
                 }
                 return;
             }

             // Otherwise, it was an automatic timeout. We want to keep listening.
             try {
                recognition.start();
             } catch (e) {
                console.error("Speech recognition auto-restart failed", e);
                setError("Speech recognition service was interrupted.");
                setStatus('error');
             }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'aborted' || event.error === 'no-speech') {
                console.log(`Speech recognition ended gracefully: ${event.error}`);
                // Let onend handle the final state logic for timeouts
                return; 
            }

            console.error('Speech recognition error:', event.error);
            setError(`Speech recognition error: ${event.error}`);
            setStatus('error');
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                manuallyStopped.current = true; // Ensure it stops on unmount
                recognitionRef.current.onresult = null;
                recognitionRef.current.onstart = null;
                recognitionRef.current.onend = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (recognitionRef.current && (statusRef.current === 'idle' || statusRef.current === 'success' || statusRef.current === 'error')) {
            try {
                manuallyStopped.current = false;
                hadResultInSession.current = false;
                recognitionRef.current.start();
            } catch(e) {
                console.error("Error starting speech recognition:", e);
                setError("Failed to start listening. Please try again.");
                setStatus('error');
                setTimeout(() => setStatus('idle'), 2000);
            }
        }
    }, []);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && statusRef.current === 'listening') {
            manuallyStopped.current = true;
            recognitionRef.current.stop();
        }
    }, []);

    return {
        status,
        isListening: status === 'listening',
        error,
        startListening,
        stopListening,
        isSupported: recognitionIsSupported,
    };
};
