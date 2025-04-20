import { useState, useEffect, RefObject } from 'react';

/**
 * Custom hook to track the intersection status of a target element.
 * @param targetRef Ref object pointing to the DOM element to observe.
 * @param options IntersectionObserver options (threshold, root, rootMargin).
 * @returns boolean indicating whether the target element is intersecting.
 */
export function useIntersectionObserver(
  targetRef: RefObject<Element>,
  options: IntersectionObserverInit = { threshold: 0.5 }
): boolean {
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);

  useEffect(() => {
    const targetElement = targetRef.current;
    if (!targetElement) {
      // console.log("IntersectionObserver: Target element not found.");
      return;
    }

    // console.log("IntersectionObserver: Setting up observer for", targetElement, options);
    const observer = new IntersectionObserver(([entry]) => {
      // console.log("IntersectionObserver: Entry changed", entry.isIntersecting, entry.target);
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(targetElement);

    // Cleanup function
    return () => {
      // console.log("IntersectionObserver: Cleaning up observer for", targetElement);
      observer.unobserve(targetElement);
    };
  }, [targetRef, options.threshold, options.root, options.rootMargin]); // Re-run if target or options change

  return isIntersecting;
} 