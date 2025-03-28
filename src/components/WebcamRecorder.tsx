
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RecordedVideo } from '@/lib/types';
import { Camera, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WebcamRecorderProps {
  onVideoCapture: (video: RecordedVideo) => void;
  isProcessing?: boolean;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({ 
  onVideoCapture,
  isProcessing = false
}) => {
  const [cameraError, setCameraError] = useState<string | null>(
    "WebcamRecorder functionality has been removed from this application."
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md rounded-lg overflow-hidden bg-gray-100 aspect-video flex items-center justify-center">
        <div className="text-center p-4">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Camera functionality has been removed</p>
        </div>
      </div>
      
      {cameraError && (
        <div className="mt-2 text-sm text-amber-500">
          {cameraError}
        </div>
      )}
      
      <div className="mt-4">
        <Button 
          onClick={() => toast.info("Camera recording functionality has been removed.")} 
          disabled={true}
          className="gap-2"
        >
          <Camera className="h-4 w-4" />
          Start Recording
        </Button>
      </div>
    </div>
  );
};

export default WebcamRecorder;
