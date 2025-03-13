import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RecordedVideo } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Camera, CheckCircle, X, RefreshCw, Play, Pause, SkipForward } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import StorageVideoPlayer from './StorageVideoPlayer';
import { Switch } from '@/components/ui/switch';

interface WebcamRecorderProps {
  onVideoRecorded: (video: RecordedVideo) => void;
  onCancel: () => void;
  onSkip?: () => void;
  className?: string;
  sourceSrc?: string;
}

const WebcamRecorder: React.FC<WebcamRecorderProps> = ({
  onVideoRecorded,
  onCancel,
  onSkip,
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
  const [sourceVideoDelay, setSourceVideoDelay] = useState<number>(0);
  const [isSourceVideoPlaying, setIsSourceVideoPlaying] = useState(false);
  const [recordingDelay, setRecordingDelay] = useState<number>(0);
  const [isSyncedPlaying, setIsSyncedPlaying] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const recordingCompleteRef = useRef<boolean>(false);
  const [showCountdown, setShowCountdown] = useState(true);

  const handleDataAvailable = useCallback((event: BlobEvent) => {
    console.log('Data available event fired, data size:', event.data.size);
    if (event.data && event.data.size > 0) {
      setRecordedChunks(prev => {
        console.log('Adding chunk, total chunks now:', prev.length + 1);
        return [...prev, event.data];
      });
    }
  }, []);

  const createPreviewFromChunks = useCallback(() => {
    console.log('Creating preview, recorded chunks:', recordedChunks.length);
    
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setIsPreviewMode(true);
      
      console.log('Preview created with URL:', url);
    }
  }, [recordedChunks]);

  useEffect(() => {
    async function setupWebcam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 1280, 
            height: 720,
            facingMode: 'user'
          }, 
          audio: false // Disable audio recording
        });
        
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
        }
        
        setCameraPermission(true);
        setError(null);
      } catch (err) {
        setCameraPermission(false);
        setError('Could not access camera');
        console.error('Error accessing media devices:', err);
      }
    }
    
    setupWebcam();
    
    return () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  const handleStartRecording = useCallback(() => {
    if (showCountdown) {
      setCountdown(3);
    }
    setRecordedChunks([]); // Clear any previous recording chunks
    recordingCompleteRef.current = false;
    
    const startRecording = () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const stream = webcamRef.current.srcObject as MediaStream;
        
        try {
          mediaRecorderRef.current = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9'
          });
          
          console.log('MediaRecorder created successfully');
          
          mediaRecorderRef.current.ondataavailable = handleDataAvailable;
          
          mediaRecorderRef.current.onstop = () => {
            console.log('MediaRecorder stopped, chunks:', recordedChunks.length);
            recordingCompleteRef.current = true;
            
            setTimeout(createPreviewFromChunks, 100);
          };
          
          if (sourceVideoRef.current && sourceSrc) {
            sourceVideoRef.current.currentTime = 0;
            sourceVideoRef.current.play()
              .then(() => {
                setIsSourceVideoPlaying(true);
                console.log('Source video playing, starting recorder with delay:', recordingDelay);
                
                setTimeout(() => {
                  if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.start();
                    setIsRecording(true);
                    console.log('Recording started successfully');
                  }
                }, recordingDelay * 1000);
              })
              .catch(err => {
                console.error('Error playing source video:', err);
                toast.error('Failed to play source video');
                
                if (mediaRecorderRef.current) {
                  mediaRecorderRef.current.start();
                  setIsRecording(true);
                  console.log('Recording started (without source video)');
                }
              });
          } else {
            mediaRecorderRef.current.start();
            setIsRecording(true);
            console.log('Recording started (no source video)');
          }
        } catch (err) {
          console.error('Failed to create MediaRecorder:', err);
          toast.error('Failed to start recording');
        }
      }
    };
    
    if (showCountdown) {
      const countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            startRecording();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownInterval);
    } else {
      startRecording();
    }
  }, [recordingDelay, sourceSrc, handleDataAvailable, createPreviewFromChunks, showCountdown]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping recording');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsSyncedPlaying(false);
      
      if (sourceVideoRef.current) {
        sourceVideoRef.current.pause();
        setIsSourceVideoPlaying(false);
      }
    }
  }, [isRecording]);

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

  const toggleSourceVideoPlayback = useCallback(() => {
    if (sourceVideoRef.current) {
      if (isSourceVideoPlaying) {
        sourceVideoRef.current.pause();
      } else {
        sourceVideoRef.current.play();
      }
      setIsSourceVideoPlaying(!isSourceVideoPlaying);
    }
  }, [isSourceVideoPlaying]);

  const resetSourceVideo = useCallback(() => {
    if (sourceVideoRef.current) {
      sourceVideoRef.current.currentTime = 0;
      if (isSourceVideoPlaying) {
        sourceVideoRef.current.play();
      }
    }
  }, [isSourceVideoPlaying]);

  const handleSyncedPlayback = useCallback(() => {
    if (sourceVideoRef.current && previewVideoRef.current && previewUrl) {
      if (isSyncedPlaying) {
        sourceVideoRef.current.pause();
        previewVideoRef.current.pause();
        setIsSyncedPlaying(false);
        console.log('Both videos paused');
      } else {
        sourceVideoRef.current.currentTime = 0;
        previewVideoRef.current.currentTime = 0;
        
        console.log('Source video element:', sourceVideoRef.current);
        console.log('Preview video element:', previewVideoRef.current);
        console.log('Preview URL:', previewUrl);
        
        Promise.all([
          sourceVideoRef.current.play().catch(e => {
            console.error('Error playing source video:', e);
            return Promise.reject(e);
          }),
          previewVideoRef.current.play().catch(e => {
            console.error('Error playing preview video:', e);
            return Promise.reject(e);
          })
        ]).then(() => {
          console.log('Both videos started playing successfully');
          setIsSyncedPlaying(true);
        }).catch(error => {
          console.error('Error playing one or both videos:', error);
          toast.error('Could not play videos: ' + error.message);
        });
      }
    } else {
      console.error('Video refs not available:', { 
        sourceRef: !!sourceVideoRef.current, 
        previewRef: !!previewVideoRef.current,
        previewUrl: !!previewUrl
      });
    }
  }, [isSyncedPlaying, previewUrl]);

  useEffect(() => {
    if (recordingCompleteRef.current && recordedChunks.length > 0 && !isPreviewMode) {
      createPreviewFromChunks();
    }
  }, [recordedChunks, isPreviewMode, createPreviewFromChunks]);

  if (cameraPermission === false) {
    return (
      <div className={cn("flex flex-col items-center justify-center space-y-4 p-8 bg-secondary/50 rounded-lg", className)}>
        <div className="text-destructive">
          <X size={48} />
        </div>
        <h2 className="text-xl font-medium">Camera Access Required</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Please allow access to your camera to record your response.
        </p>
        <Button onClick={onCancel}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
        {sourceSrc && (
          <div className="h-full flex flex-col">
            <div className="rounded-lg overflow-hidden flex-1">
              {sourceSrc.startsWith('idb://') ? (
                <StorageVideoPlayer
                  videoLocation={sourceSrc}
                  className="w-full h-full object-cover rounded-lg"
                  controls={!isRecording && !isPreviewMode}
                  muted
                />
              ) : (
                <video
                  ref={sourceVideoRef}
                  src={sourceSrc}
                  className="w-full h-full object-cover rounded-lg"
                  playsInline
                  muted
                  controls={!isRecording && !isPreviewMode}
                  onPlay={() => setIsSourceVideoPlaying(true)}
                  onPause={() => setIsSourceVideoPlaying(false)}
                />
              )}
            </div>
            
            {!isRecording && !isPreviewMode && (
              <div className="mt-2 px-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Recording delay: {recordingDelay.toFixed(1)} {recordingDelay === 1 ? 'second' : 'seconds'}
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={toggleSourceVideoPlayback}
                      className="h-8 w-8 p-0 rounded-full"
                    >
                      {isSourceVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={resetSourceVideo}
                      className="h-8 w-8 p-0 rounded-full text-xs"
                    >
                      <span className="text-xs">0:00</span>
                    </Button>
                  </div>
                </div>
                <div className="py-2">
                  <Slider 
                    value={[recordingDelay]} 
                    onValueChange={(values) => setRecordingDelay(values[0])}
                    max={1}
                    step={0.1}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="relative h-full rounded-lg overflow-hidden bg-black">
          {isPreviewMode && previewUrl ? (
            <video 
              ref={previewVideoRef}
              src={previewUrl} 
              className="w-full h-full object-cover rounded-lg"
              controls={false}
              playsInline
              muted={false}
              autoPlay={false}
              key={previewUrl}
            />
          ) : (
            <video
              ref={webcamRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover rounded-lg"
            />
          )}
          
          {isRecording && <div className="recording-indicator" />}
          
          {countdown !== null && showCountdown && (
            <div className="countdown-overlay">
              <div className="countdown-number">{countdown}</div>
            </div>
          )}
        </div>
      </div>
      
      {isPreviewMode && (
        <div className="mt-4 flex justify-center">
          <Button
            onClick={handleSyncedPlayback}
            variant="outline"
            className="rounded-full px-6"
          >
            {isSyncedPlaying ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                <span>Pause Videos</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                <span>Play Both Videos</span>
              </>
            )}
          </Button>
        </div>
      )}
      
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
            
            {onSkip && (
              <Button 
                variant="outline" 
                onClick={onSkip}
                className="flex items-center space-x-2 rounded-full px-6"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                <span>Skip</span>
              </Button>
            )}
            
            {!isRecording && (
              <div className="flex items-center gap-2 bg-background border border-input rounded-full px-6 py-2">
                <span className="text-sm">Countdown</span>
                <Switch
                  checked={showCountdown}
                  onCheckedChange={setShowCountdown}
                />
              </div>
            )}
            
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
