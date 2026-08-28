import { useState, useCallback, useRef, useEffect } from 'react';
import type { RefObject } from 'react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { parseVoiceCommand, describeCommand, VoiceCommand } from '../utils/voiceCommandParser';
import { ItemType, BoardItem } from '../types';

interface UseVoiceCommandsProps {
  mousePosition: { x: number; y: number };
  onCreateItem: (type: ItemType, options?: Partial<BoardItem>, x?: number, y?: number) => void;
  canvasRef: RefObject<HTMLDivElement>;
}

export function useVoiceCommands({ mousePosition, onCreateItem, canvasRef }: UseVoiceCommandsProps) {
  const [isActive, setIsActive] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [lastParsedCommand, setLastParsedCommand] = useState<VoiceCommand | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | null>(null);
  
  // Store mouse position when command starts to prevent drift during speech
  const capturedMousePosition = useRef({ x: 0, y: 0 });
  
  const handleTranscript = useCallback((transcript: string) => {
    console.log('🎤 Voice transcript received:', transcript);
    setLastCommand(transcript);
    
    const command = parseVoiceCommand(transcript);
    setLastParsedCommand(command);
    
    if (command.action === 'create' && command.itemType && command.confidence > 0.7) {
      const options: Partial<BoardItem> = {
        ...command.properties,
        ...(command.shape && { shape: command.shape })
      };
      
      // Use the captured mouse position from when listening started
      const { x, y } = capturedMousePosition.current;
      
      console.log('✅ Creating item via voice at position:', { x, y });
      console.log('   Item type:', command.itemType);
      console.log('   Options:', options);
      
      onCreateItem(
        command.itemType,
        options,
        x,
        y
      );
      
      const description = describeCommand(command);
      setFeedback(`✓ ${description}`);
      setFeedbackType('success');
      
      // Clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback('');
        setFeedbackType(null);
      }, 3000);
      
    } else if (command.action === 'unknown' || command.confidence <= 0.7) {
      console.log('❌ Command not recognized or low confidence:', { command, confidence: command.confidence });
      setFeedback(`✗ Command not recognized: "${transcript}"`);
      setFeedbackType('error');
      
      // Clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback('');
        setFeedbackType(null);
      }, 3000);
    }
  }, [onCreateItem]);
  
  const { status, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleTranscript
  });
  
  // Capture mouse position when listening starts
  useEffect(() => {
    if (status === 'listening') {
      capturedMousePosition.current = { ...mousePosition };
      console.log('📍 Captured mouse position:', capturedMousePosition.current);
    }
  }, [status, mousePosition]);
  
  const toggleVoiceCommands = useCallback(() => {
    if (isActive) {
      console.log('🔇 Disabling voice commands');
      stopListening();
      setIsActive(false);
      setFeedback('');
      setFeedbackType(null);
    } else {
      console.log('🔊 Enabling voice commands');
      startListening();
      setIsActive(true);
      setFeedback('Voice commands active - Say "create a note"');
      setFeedbackType('info');
      
      // Clear info message after 4 seconds
      setTimeout(() => {
        if (isActive) {
          setFeedback('');
          setFeedbackType(null);
        }
      }, 4000);
    }
  }, [isActive, startListening, stopListening]);
  
  return {
    isActive,
    isSupported,
    status,
    lastCommand,
    lastParsedCommand,
    feedback,
    feedbackType,
    toggleVoiceCommands
  };
}
