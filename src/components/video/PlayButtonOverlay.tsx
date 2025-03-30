
import React from 'react';
import { Play } from 'lucide-react';

interface PlayButtonOverlayProps {
  visible: boolean;
  previewMode?: boolean;
}

const PlayButtonOverlay: React.FC<PlayButtonOverlayProps> = ({
  visible,
  previewMode = false
}) => {
  if (!visible || previewMode) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="rounded-full bg-black/40 p-3">
        <Play className="h-6 w-6 text-white" />
      </div>
    </div>
  );
};

export default PlayButtonOverlay;
