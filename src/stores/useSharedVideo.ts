import create from 'zustand';

interface MoveOptions {
  muted?: boolean;
  controls?: boolean;
  className?: string;
}

interface SharedVideoState {
  /** Currently managed HTMLVideoElement */
  videoElement: HTMLVideoElement | null;
  /** Container that originally owns / previews the element */
  previewContainer: HTMLElement | null;
  /** Active video src being managed */
  currentSrc: string | null;
  /** Whether the element is currently displayed in the lightbox */
  isInLightbox: boolean;
  /** Register / mount a video element that belongs to a preview card */
  mountVideoElement: (
    element: HTMLVideoElement,
    src: string,
    previewContainer: HTMLElement,
  ) => void;
  /** Move the managed element to a new container (e.g., the lightbox) */
  moveToContainer: (container: HTMLElement, options?: MoveOptions) => void;
  /** Return the managed element back to its preview container */
  returnToPreview: () => void;
}

export const useSharedVideo = create<SharedVideoState>((set, get) => ({
  videoElement: null,
  previewContainer: null,
  currentSrc: null,
  isInLightbox: false,

  mountVideoElement: (element, src, previewContainer) => {
    // Ignore if same element already registered and src unchanged
    const state = get();
    if (state.videoElement === element && state.currentSrc === src) {
      return;
    }

    // Ensure previewContainer holds the element
    if (previewContainer && element.parentElement !== previewContainer) {
      try {
        previewContainer.appendChild(element);
      } catch {
        /* ignored */
      }
    }

    // Standard preview defaults
    element.muted = true;
    element.controls = false;
    element.classList.remove('object-contain');
    element.classList.add('object-cover');

    set({
      videoElement: element,
      currentSrc: src,
      previewContainer,
      isInLightbox: false,
    });
  },

  moveToContainer: (container, options) => {
    const { videoElement } = get();
    if (!videoElement || !container) return;

    // Move DOM node
    if (videoElement.parentElement !== container) {
      try {
        container.appendChild(videoElement);
      } catch {
        /* ignored */
      }
    }

    // Apply options
    if (options) {
      if (options.muted !== undefined) videoElement.muted = options.muted;
      if (options.controls !== undefined) videoElement.controls = options.controls;
      if (options.className !== undefined) videoElement.className = options.className;
    }

    set({ isInLightbox: true });
  },

  returnToPreview: () => {
    const { videoElement, previewContainer } = get();
    if (!videoElement || !previewContainer) return;

    if (videoElement.parentElement !== previewContainer) {
      try {
        previewContainer.appendChild(videoElement);
      } catch {
        /* ignored */
      }
    }

    // Restore preview defaults
    videoElement.muted = true;
    videoElement.controls = false;
    videoElement.classList.remove('object-contain');
    videoElement.classList.add('object-cover');

    set({ isInLightbox: false });
  },
})); 