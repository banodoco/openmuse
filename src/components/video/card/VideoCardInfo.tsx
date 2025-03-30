
import React from 'react';
import { VideoEntry } from '@/lib/types';

interface VideoCardInfoProps {
  title: string;
  creatorName: string;
}

const VideoCardInfo: React.FC<VideoCardInfoProps> = ({
  title,
  creatorName
}) => {
  return (
    <div className="p-2 bg-card">
      <h3 className="font-medium text-sm truncate">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground">By {creatorName}</p>
    </div>
  );
};

export default VideoCardInfo;
