export async function getVideoAspectRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      // Handle non-browser environments (e.g., server-side)
      resolve(null);
      return;
    }
    const v = document.createElement('video');
    v.src = url;
    v.crossOrigin = 'anonymous';
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      if (v.videoWidth && v.videoHeight) {
        resolve(v.videoWidth / v.videoHeight);
      } else {
        resolve(null);
      }
    };
    v.onerror = () => resolve(null);
  });
} 