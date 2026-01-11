// FILE: src/hooks/useUndoRedo.js
// Hook for managing undo/redo history with configurable max history size
import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50; // Maximum number of undo states

export function useUndoRedo(initialState = []) {
  const [elements, setElementsInternal] = useState(initialState);
  const historyRef = useRef([]); // Past states (for undo)
  const futureRef = useRef([]); // Future states (for redo)

  // Push current state to history before making changes
  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current, elements].slice(-MAX_HISTORY);
    futureRef.current = []; // Clear redo stack on new action
  }, [elements]);

  // Set elements with history tracking
  const setElements = useCallback((update) => {
    setElementsInternal((prev) => {
      // Save current state to history
      historyRef.current = [...historyRef.current, prev].slice(-MAX_HISTORY);
      futureRef.current = []; // Clear redo stack on new action

      // Apply the update
      const next = typeof update === 'function' ? update(prev) : update;
      return next;
    });
  }, []);

  // Set elements WITHOUT history tracking (for loading saved data)
  const setElementsNoHistory = useCallback((update) => {
    setElementsInternal((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      return next;
    });
    // Reset history when loading
    historyRef.current = [];
    futureRef.current = [];
  }, []);

  // Undo: restore previous state
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return false;

    setElementsInternal((current) => {
      // Save current state to future (for redo)
      futureRef.current = [current, ...futureRef.current];
      // Pop last state from history
      const previous = historyRef.current[historyRef.current.length - 1];
      historyRef.current = historyRef.current.slice(0, -1);
      return previous;
    });
    return true;
  }, []);

  // Redo: restore next state
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false;

    setElementsInternal((current) => {
      // Save current state to history
      historyRef.current = [...historyRef.current, current];
      // Pop first state from future
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      return next;
    });
    return true;
  }, []);

  // Check if undo/redo is available
  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Reset all history
  const resetHistory = useCallback(() => {
    historyRef.current = [];
    futureRef.current = [];
    setElementsInternal([]);
  }, []);

  return {
    elements,
    setElements,
    setElementsNoHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory,
    historyLength: historyRef.current.length,
    futureLength: futureRef.current.length,
  };
}
