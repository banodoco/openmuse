
import React, { useEffect, useState } from 'react';
import { Logger } from '@/lib/logger';

const logger = new Logger('LazyPosterImage');

interface LazyPosterImageProps {
  poster?: string;
  lazyLoad: boolean;
  hasInteracted: boolean;
  isMobile?: boolean;
}

const LazyPosterImage: React.FC<LazyPosterImageProps> = ({
  poster,
  lazyLoad,
  hasInteracted,
  isMobile = false
}) => {
  const [posterLoaded, setPosterLoaded] = useState(false);
  
  useEffect(() => {
    if (poster) {
      const img = new Image();
      img.onload = () => {
        setPosterLoaded(true);
        logger.log('Poster image loaded successfully');
      };
      img.onerror = () => {
        logger.error('Failed to load poster image:', poster);
        setPosterLoaded(false);
      };
      img.src = poster;
    }
  }, [poster]);
  
  // For mobile, skip this component entirely as VideoOverlay will handle it
  if (isMobile) {
    return null;
  }
  
  // For desktop, proceed with normal logic
  if (!lazyLoad || hasInteracted || !poster || !posterLoaded) {
    return null;
  }
  
  return (
    <div 
      className="absolute inset-0 bg-cover bg-center" 
      style={{ backgroundImage: `url(${poster})` }}
    />
  );
};

export default LazyPosterImage;
