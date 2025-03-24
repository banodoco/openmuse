
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  text?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({ text = "Loading..." }) => {
  return (
    <div className="h-96 flex flex-col gap-2 items-center justify-center animate-pulse-opacity">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      {text && <p className="text-muted-foreground">{text}</p>}
    </div>
  );
};

export default LoadingState;
