
import React from 'react';
import { VideoEntry, RecordedVideo } from '@/lib/types';
import WebcamRecorder from '@/components/WebcamRecorder';

interface RecorderWrapperProps {
  video: VideoEntry;
  onVideoRecorded: (recordedVideo: RecordedVideo) => void;
  onCancel: () => void;
  onSkip: () => void;
}

const RecorderWrapper: React.FC<RecorderWrapperProps> = ({
  video,
  onVideoRecorded,
  onCancel,
  onSkip
}) => {
  return (
    <div className="animate-scale-in">
      <h2 className="text-2xl font-bold mb-6">Record Your Response</h2>
      <div className="bg-card shadow-subtle rounded-xl overflow-hidden">
        <WebcamRecorder
          onVideoRecorded={onVideoRecorded}
          onCancel={onCancel}
          onSkip={onSkip}
          className="p-6"
          sourceSrc={video.video_location}
        />
      </div>
    </div>
  );
};

export default RecorderWrapper;
