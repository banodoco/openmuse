
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RecordedVideo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Camera, CheckCircle, X, RefreshCw } from 'lucide-react';

interface WebcamRecorderProps {
  onVideoRecorded: (video: RecordedVideo) => void;
  onCancel: () => void;
  className?: string;
  sourceSrc?: string;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({
  onVideoRecorded,
  onCancel,
  className,
  sourceSrc,
}) => {
  const webcamRef = useRef<HTMLVideoElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize webcam on mount
  useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 1280, 
            height: 720,
            facingMode: 'user'
          }, 
          audio: true 
        });
        
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
        
        setCameraPermission(true);
        setError(null);
      } catch (err) {
        setCameraPermission(false);
        setError('Could not access camera or microphone');
        console.error('Error accessing media devices:', err);
      }
    }
    
    setupWebcam();
    
    return () => {
      // Clean up streams when component unmounts
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const handleStartRecording = useCallback(() => {
    // Start countdown before recording
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          
          if (webcamRef.current && webcamRef.current.srcObject) {
            const stream = webcamRef.current.srcObject as MediaStream;
            mediaRecorderRef.current = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp9,opus'
            });
            mediaRecorderRef.current.ondataavailable = handleDataAvailable;
            mediaRecorderRef.current.start();
            setIsRecording(true);
          }
          
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  }, []);

  const handleDataAvailable = useCallback(({ data }: BlobEvent) => {
    if (data.size > 0) {
      setRecordedChunks(prev => [...prev, data]);
    }
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Slight delay to ensure all chunks are processed
      setTimeout(() => {
        if (recordedChunks.length > 0) {
          const blob = new Blob(recordedChunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setIsPreviewMode(true);
        }
      }, 100);
    }
  }, [isRecording, recordedChunks]);

  const handleConfirm = useCallback(() => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      onVideoRecorded({ blob, url });
    }
  }, [recordedChunks, onVideoRecorded]);

  const handleRetry = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedChunks([]);
    setPreviewUrl(null);
    setIsPreviewMode(false);
  }, [previewUrl]);

  // If camera permission is denied
  if (cameraPermission === false) {
    return (
      <div className={cn("flex flex-col items-center justify-center space-y-4 p-8 bg-secondary/50 rounded-lg", className)}>
        <div className="text-destructive">
          <X size={48} />
        </div>
        <h2 className="text-xl font-medium">Camera Access Required</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please allow access to your camera and microphone to record your response.
        </p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {/* Source video (what the user is responding to) */}
        {sourceSrc && (
          <div className="h-full rounded-lg overflow-hidden">
            <video
              ref={sourceVideoRef}
              src={sourceSrc}
              className="w-full h-full object-cover rounded-lg"
              controls
              playsInline
            />
          </div>
        )}
        
        {/* Webcam preview or recorded video preview */}
        <div className="relative h-full rounded-lg overflow-hidden bg-black">
          {isPreviewMode && previewUrl ? (
            <video 
              src={previewUrl} 
              className="w-full h-full object-cover rounded-lg" 
              controls 
              autoPlay 
              loop 
              playsInline
            />
          ) : (
            <video
              ref={webcamRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg transform scale-x-[-1]"
            />
          )}
          
          {/* Recording indicator */}
          {isRecording && <div className="recording-indicator" />}
          
          {/* Countdown overlay */}
          {countdown !== null && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdown}</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Control buttons */}
      <div className="mt-6 flex justify-center space-x-4">
        {isPreviewMode ? (
          <>
            <Button 
              variant="outline" 
              onClick={handleRetry}
              className="flex items-center space-x-2 rounded-full px-6"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <span>Retry</span>
            </Button>
            <Button 
              onClick={handleConfirm}
              className="flex items-center space-x-2 rounded-full px-6 bg-primary hover:bg-primary/90 transition-colors"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              <span>Confirm</span>
            </Button>
          </>
        ) : (
          <>
            <Button 
              variant="outline" 
              onClick={onCancel}
              className="flex items-center space-x-2 rounded-full px-6"
            >
              <X className="h-4 w-4 mr-2" />
              <span>Cancel</span>
            </Button>
            {!isRecording ? (
              <Button 
                onClick={handleStartRecording}
                className="flex items-center space-x-2 rounded-full px-6 bg-primary hover:bg-primary/90 transition-colors"
              >
                <Camera className="h-4 w-4 mr-2" />
                <span>Start Recording</span>
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                onClick={handleStopRecording}
                className="flex items-center space-x-2 rounded-full px-6"
              >
                <span>Stop Recording</span>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WebcamRecorder;
