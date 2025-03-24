
import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload as UploadIcon } from 'lucide-react';

interface VideoDropzoneProps {
  id: string;
  file: File | null;
  url: string | null;
  onDrop: (acceptedFiles: File[]) => void;
}

const VideoDropzone: React.FC<VideoDropzoneProps> = ({ id, file, url, onDrop }) => {
  // Log props to make sure they're being passed correctly
  console.log(`VideoDropzone props - id: ${id}, file: ${file ? 'present' : 'null'}, url: ${url}`);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      console.log("Dropzone onDrop called with files:", acceptedFiles);
      if (acceptedFiles && acceptedFiles.length > 0) {
        onDrop(acceptedFiles);
      }
    },
    accept: {
      'video/*': []
    }
  });
  
  return (
    <div 
      {...getRootProps()} 
      className="dropzone mt-1 border-2 border-dashed rounded-md p-8 text-center cursor-pointer bg-muted/50 w-full md:w-1/2"
    >
      <input {...getInputProps()} id={`video-${id}`} />
      <div className="flex flex-col items-center justify-center">
        <UploadIcon className="h-12 w-12 text-muted-foreground mb-4" />
        {
          isDragActive ?
            <p>Drop the video here ...</p> :
            <>
              <p className="text-lg font-medium mb-2">Drag 'n' drop a video here</p>
              <p className="text-sm text-muted-foreground">or click to select a file</p>
            </>
        }
      </div>
    </div>
  );
};

export default VideoDropzone;
