
import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingState: React.FC = () => {
  return (
    <div className="h-96 flex items-center justify-center animate-pulse-opacity">
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
    </div>
  );
};

export default LoadingState;
