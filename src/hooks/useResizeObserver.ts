import { useState, useEffect, useRef, RefObject } from 'react';

// Define the type for the callback function
type ResizeCallback = (entry: ResizeObserverEntry) => void;

/**
 * A custom React hook that uses ResizeObserver to monitor an element's size changes.
 * 
 * @param ref - A RefObject pointing to the DOM element to observe.
 * @param callback - A function to call when the element's size changes. It receives the ResizeObserverEntry.
 */
export const useResizeObserver = (ref: RefObject<Element>, callback: ResizeCallback) => {
  useEffect(() => {
    // Ensure ref.current and ResizeObserver are available
    if (!ref.current || typeof ResizeObserver === 'undefined') {
      return;
    }

    // Create a ResizeObserver instance
    const observer = new ResizeObserver((entries) => {
      // We only observe one element, so we can directly access the first entry
      const entry = entries[0];
      if (entry) {
        // Call the provided callback with the entry
        callback(entry);
      }
    });

    // Start observing the target element
    observer.observe(ref.current);

    // Cleanup function: disconnect the observer when the component unmounts or the ref changes
    return () => {
      observer.disconnect();
    };
  }, [ref, callback]); // Re-run the effect if the ref or callback changes
}; 