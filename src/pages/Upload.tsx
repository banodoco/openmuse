
import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { databaseSwitcher } from '@/lib/databaseSwitcher';
import Navigation from '@/components/Navigation';
import { UploadCloud, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { remoteStorage } from '@/lib/remoteStorage';

const Upload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [reviewerName, setReviewerName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleSelectFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files).filter(
        file => file.type.startsWith('video/')
      );
      
      if (fileArray.length === 0) {
        toast.error('Please select video files only.');
        return;
      }
      
      setFiles(fileArray);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const fileArray = Array.from(e.dataTransfer.files).filter(
        file => file.type.startsWith('video/')
      );
      
      if (fileArray.length === 0) {
        toast.error('Please drop video files only.');
        return;
      }
      
      setFiles(fileArray);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) {
      toast.error('Please select at least one video file to upload.');
      return;
    }
    
    if (!reviewerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    
    setUploading(true);
    
    try {
      const db = databaseSwitcher.getDatabase();
      
      for (const file of files) {
        // Create a VideoFile object for uploading to Supabase storage
        const videoFile = {
          id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          blob: file
        };
        
        // Upload to Supabase storage first
        const videoLocation = await remoteStorage.uploadVideo(videoFile);
        console.log(`Video uploaded to Supabase: ${videoLocation}`);
        
        // Now add the entry to the database with the Supabase URL
        await db.addEntry({
          video_location: videoLocation,
          reviewer_name: reviewerName,
          acting_video_location: null,
          skipped: false
        });
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      toast.success(`${files.length} video${files.length > 1 ? 's' : ''} uploaded successfully!`);
      
      setFiles([]);
      setReviewerName('');
      setUploading(false);
      
      navigate('/');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('An error occurred during upload. Please try again.');
      setUploading(false);
    }
  }, [files, reviewerName, navigate]);

  const isNameFilled = reviewerName.trim().length > 0;
  const areFilesFilled = files.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background animate-fade-in">
      <Navigation />
      
      <main className="flex-1 container max-w-4xl py-8 px-4">
        <div className="animate-slide-in">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Upload Videos</h1>
          <p className="text-muted-foreground mb-8">
            Upload videos for others to respond to with their acting.
          </p>
          
          <div className="space-y-6">
            <div>
              <Label htmlFor="reviewer-name" className="text-sm font-medium mb-2 block">
                Your Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reviewer-name"
                placeholder="Enter your name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className={cn("max-w-md", !isNameFilled && "border-destructive focus-visible:ring-destructive/50")}
                disabled={uploading}
              />
              {!isNameFilled && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Name is required
                </p>
              )}
            </div>
            
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200",
                "hover:border-primary/50 hover:bg-secondary/50",
                "flex flex-col items-center justify-center gap-4",
                uploading && "pointer-events-none opacity-60",
                !areFilesFilled && "border-destructive"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {uploading ? (
                <div className="text-center animate-scale-in">
                  <div className="flex justify-center mb-2">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  </div>
                  <h3 className="text-lg font-medium">Uploading...</h3>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                    <UploadCloud className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">
                      {files.length > 0 
                        ? `${files.length} video${files.length > 1 ? 's' : ''} selected` 
                        : 'Drag videos here or click to browse'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload the videos you want others to respond to
                    </p>
                    {!areFilesFilled && (
                      <p className="text-sm text-destructive mt-1 flex items-center gap-1 justify-center">
                        <Info className="h-3 w-3" /> At least one video is required
                      </p>
                    )}
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                onChange={handleSelectFiles}
                className="hidden"
                disabled={uploading}
              />
            </div>
            
            {files.length > 0 && (
              <div className="animate-slide-in">
                <h3 className="text-sm font-semibold mb-3">Selected videos:</h3>
                <ul className="space-y-2">
                  {files.map((file, index) => (
                    <li key={index} className="flex items-center text-sm bg-secondary/50 p-3 rounded-md">
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-muted-foreground ml-2">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex flex-col items-end pt-4">
              {!isNameFilled || !areFilesFilled ? (
                <p className="text-sm text-destructive mb-2 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Please fill in all required fields to enable upload
                </p>
              ) : null}
              
              <Button
                className="rounded-full px-8"
                disabled={uploading || files.length === 0 || !reviewerName.trim()}
                onClick={handleUpload}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload Videos'
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Upload;
