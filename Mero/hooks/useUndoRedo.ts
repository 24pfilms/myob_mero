import { useRef, useCallback, useState } from 'react';

interface UndoRedoState<T> {
  history: T[];
  currentIndex: number;
}

export const useUndoRedo = <T>(initialState: T, maxHistorySize: number = 50) => {
  const [state, setState] = useState<UndoRedoState<T>>({
    history: [initialState],
    currentIndex: 0
  });

  const pushToHistory = useCallback((newState: T) => {
    setState(prevState => {
      // Remove any future states if we're not at the end
      const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
      
      // Add the new state
      newHistory.push(newState);
      
      // Keep history size under limit
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        return {
          history: newHistory,
          currentIndex: newHistory.length - 1
        };
      }
      
      return {
        history: newHistory,
        currentIndex: newHistory.length - 1
      };
    });
  }, [maxHistorySize]);

  const resetHistory = useCallback((newState: T) => {
    setState({
      history: [newState],
      currentIndex: 0,
    });
  }, []);

  const undo = useCallback(() => {
    setState(prevState => {
      if (prevState.currentIndex > 0) {
        return {
          ...prevState,
          currentIndex: prevState.currentIndex - 1
        };
      }
      return prevState;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prevState => {
      if (prevState.currentIndex < prevState.history.length - 1) {
        return {
          ...prevState,
          currentIndex: prevState.currentIndex + 1
        };
      }
      return prevState;
    });
  }, []);

  const canUndo = state.currentIndex > 0;
  const canRedo = state.currentIndex < state.history.length - 1;
  const currentState = state.history[state.currentIndex];

  return {
    currentState,
    pushToHistory,
    resetHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    historySize: state.history.length,
    currentIndex: state.currentIndex
  };
};