import { RefObject, useEffect, useRef, useLayoutEffect } from 'react';

/**
 * Adds a fade-in (and optional subtle slide-up) animation to any element when it enters the viewport.
 *
 * The element starts fully transparent and slightly translated on the Y axis. When it becomes
 * visible (based on the supplied IntersectionObserver options) we add Tailwind utility classes
 * together with the existing `animate-fade-in` keyframe to smoothly reveal it.
 *
 * Usage:
 *   const sectionRef = useRef<HTMLDivElement>(null);
 *   useFadeInOnScroll(sectionRef);
 *
 *   return <div ref={sectionRef}>...</div>;
 */
export function useFadeInOnScroll(
  targetRef: RefObject<HTMLElement>,
  options: IntersectionObserverInit = { threshold: 0.05 }
) {
  const hasAnimatedRef = useRef(false);

  // Add hidden styles only if the element starts outside the viewport to avoid flash/flicker
  useLayoutEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    if (hasAnimatedRef.current) return;

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const rect = el.getBoundingClientRect();
    const fullyAbove = rect.bottom < 0;
    const fullyBelow = rect.top > viewportHeight;

    if (fullyAbove || fullyBelow) {
      // Element starts outside viewport – hide it and let the observer reveal it later
      el.classList.add('opacity-0', 'translate-y-4');
    } else {
      // Element already visible on first paint – animate immediately without hiding
      requestAnimationFrame(() => {
        el.classList.add('animate-slide-in');
        hasAnimatedRef.current = true;
      });
    }
  }, [targetRef]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    // If it already animated, no need to observe again
    if (hasAnimatedRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        el.classList.remove('opacity-0', 'translate-y-4');
        el.classList.add('animate-slide-in');
        hasAnimatedRef.current = true;
        observer.disconnect();
      }
    }, options);

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [targetRef.current, options.root, options.rootMargin, options.threshold]);
} 