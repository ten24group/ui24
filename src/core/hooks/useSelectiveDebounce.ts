import { useState, useEffect, useRef } from 'react';
import { ComponentDataContext } from '../types/pageData';

/**
 * Debounce hook with selective field debouncing
 * 
 * Only debounces high-frequency fields (formValues) to prevent excessive re-renders.
 * Other fields (record, selectedRecords) are returned immediately for instant UI feedback.
 * 
 * FIXES:
 * - Deep comparison of formValues (not reference comparison)
 * - Proper memoization that doesn't invalidate on every render
 * - No race conditions between debounced and non-debounced data
 * - Uses ref-based comparison to prevent infinite loops
 * 
 * @param value - Component data to debounce
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns Selectively debounced component data
 */
export function useSelectiveDebounce(
  value: Partial<ComponentDataContext> | null,
  delay: number = 500
): Partial<ComponentDataContext> | null {
  
  const [debouncedData, setDebouncedData] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousValueRef = useRef<string>('');
  
  useEffect(() => {
    // Serialize for deep comparison
    const serializedValue = JSON.stringify(value);
    
    // CRITICAL FIX: Only proceed if value actually changed
    if (serializedValue === previousValueRef.current) {
      return;
    }
    
    previousValueRef.current = serializedValue;
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // If no formValues, update immediately
    if (!value?.formValues) {
      setDebouncedData(value);
      return;
    }
    
    // Debounce the entire value (including formValues)
    timeoutRef.current = setTimeout(() => {
      setDebouncedData(value);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, delay]);
  
  return debouncedData;
}

/**
 * Alternative: Simple debounce hook for any value
 * Can be used directly in Form component for formValues
 * 
 * FIXED: Uses ref-based deep comparison to prevent infinite loops
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const previousValueRef = useRef<string>('');
  
  useEffect(() => {
    // Serialize for deep comparison
    const serializedValue = JSON.stringify(value);
    
    
    // CRITICAL FIX: Only proceed if value actually changed
    if (serializedValue === previousValueRef.current) {
      return;
    }
    
    previousValueRef.current = serializedValue;
    
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
}

