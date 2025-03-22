
import React from 'react';
import { VideoIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <VideoIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
}) => {
  return (
    <div className="h-96 flex flex-col items-center justify-center text-center animate-slide-in">
      {icon}
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        {description}
      </p>
    </div>
  );
};

export default EmptyState;
