import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { RecordedVideo } from '@/lib/types';
import { Camera, StopCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface WebcamRecorderProps {
  onVideoCapture: (video: RecordedVideo) => void;
  isProcessing?: boolean;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({ 
  onVideoCapture,
  isProcessing = false
}) => {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<BlobPart[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleStartCapture = useCallback(() => {
    if (!webcamRef.current?.video) {
      toast.error("Camera not available. Please refresh and try again.");
      return;
    }

    setIsCapturing(true);
    setCameraError(null);

    try {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      
      if (!stream) {
        throw new Error("No camera stream available");
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });
      
      mediaRecorderRef.current.addEventListener("dataavailable", ({ data }) => {
        if (data.size > 0) {
          setRecordedChunks((prev) => [...prev, data]);
        }
      });
      
      mediaRecorderRef.current.start();
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsCapturing(false);
      setCameraError("Failed to start recording. Please check camera permissions.");
      toast.error("Failed to start recording. Please check camera permissions.");
    }
  }, [webcamRef, setIsCapturing, setRecordedChunks]);

  const handleStopCapture = () => {
    if (mediaRecorderRef.current && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, {
        type: "video/webm",
      });
      const url = URL.createObjectURL(blob);
      
      // Create a RecordedVideo object with necessary id field
      const recordedVideo: RecordedVideo = {
        id: crypto.randomUUID(),
        blob,
        url,
      };
      
      onVideoCapture(recordedVideo);
      setIsCapturing(false);
      setRecordedChunks([]);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setCameraError(null);
    
    // Force webcam to re-initialize
    if (webcamRef.current?.video?.srcObject) {
      const stream = webcamRef.current.video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      webcamRef.current.video.srcObject = null;
    }
    
    // Short timeout to allow cleanup before re-initializing
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  useEffect(() => {
    if (mediaRecorderRef.current && isCapturing) {
      mediaRecorderRef.current.addEventListener("stop", handleStopCapture);
      return () => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.removeEventListener("stop", handleStopCapture);
        }
      };
    }
  }, [isCapturing, recordedChunks]);

  useEffect(() => {
    return () => {
      // Clean up any media streams when component unmounts
      if (webcamRef.current?.video?.srcObject) {
        const stream = webcamRef.current.video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleUserMediaError = useCallback((error: string | DOMException) => {
    console.error("Webcam error:", error);
    const errorMessage = typeof error === 'string' 
      ? error 
      : "Camera access denied or device not available";
    setCameraError(errorMessage);
    toast.error(errorMessage);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-md rounded-lg overflow-hidden bg-black">
        {isRefreshing ? (
          <div className="aspect-video w-full flex items-center justify-center bg-muted">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Webcam
            audio={true}
            ref={webcamRef}
            videoConstraints={{
              facingMode: "user",
              width: 1280,
              height: 720,
            }}
            onUserMediaError={handleUserMediaError}
            className="w-full"
          />
        )}
        
        {isCapturing && (
          <div className="absolute top-2 right-2">
            <div className="animate-pulse flex items-center">
              <div className="h-3 w-3 rounded-full bg-red-500 mr-2"></div>
              <span className="text-white text-xs font-medium">REC</span>
            </div>
          </div>
        )}
      </div>
      
      {cameraError && (
        <div className="mt-2 text-sm text-red-500">
          {cameraError}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            className="ml-2"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh Camera
          </Button>
        </div>
      )}
      
      <div className="mt-4 flex gap-4">
        {!isCapturing ? (
          <Button 
            onClick={handleStartCapture} 
            disabled={isProcessing || isRefreshing || !!cameraError}
            className="gap-2"
          >
            <Camera className="h-4 w-4" />
            Start Recording
          </Button>
        ) : (
          <Button 
            onClick={() => mediaRecorderRef.current?.stop()} 
            variant="destructive"
            className="gap-2"
          >
            <StopCircle className="h-4 w-4" />
            Stop Recording
          </Button>
        )}
        
        {!isCapturing && !isRefreshing && (
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isProcessing}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh Camera
          </Button>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;
