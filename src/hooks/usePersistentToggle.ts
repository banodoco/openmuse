import { useState, useEffect, useCallback } from 'react';

type ToggleValue = 'all' | 'curated';

/**
 * Custom hook to manage a persistent toggle state ('all' or 'curated') using localStorage.
 * 
 * @param storageKey The unique key for storing the state in localStorage.
 * @param defaultValue The default value if nothing is found in localStorage.
 * @returns A tuple containing the current state and a function to update the state.
 */
export function usePersistentToggle(
  storageKey: string, 
  defaultValue: ToggleValue = 'curated'
): [ToggleValue, (newValue: ToggleValue) => void] {
  
  const [value, setValue] = useState<ToggleValue>(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      // Ensure stored value is valid, otherwise return default
      if (storedValue === 'all' || storedValue === 'curated') {
        return storedValue;
      }
    } catch (error) {
      console.error(`Error reading localStorage key “${storageKey}”:`, error);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      // Ensure value is valid before storing
      if (value === 'all' || value === 'curated') {
        window.localStorage.setItem(storageKey, value);
      } else {
         // Fallback to default if state somehow becomes invalid
         window.localStorage.setItem(storageKey, defaultValue);
         setValue(defaultValue); 
      }
    } catch (error) {
      console.error(`Error setting localStorage key “${storageKey}”:`, error);
    }
  }, [storageKey, value, defaultValue]);

  const updateValue = useCallback((newValue: ToggleValue) => {
    // Only update if the value is valid
    if (newValue === 'all' || newValue === 'curated') {
      setValue(newValue);
    } else {
        console.warn(`Attempted to set invalid value for usePersistentToggle (${storageKey}): ${newValue}`);
    }
  }, [storageKey]); // Add storageKey to dependencies if needed, though it usually doesn't change

  return [value, updateValue];
} 