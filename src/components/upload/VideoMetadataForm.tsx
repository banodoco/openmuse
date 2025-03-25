
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VideoMetadataFormProps {
  videoId: string;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'gen';
  };
  updateMetadata: (id: string, field: string, value: any) => void;
}

const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ videoId, metadata, updateMetadata }) => {
  return (
    <div className="space-y-4">
      <h4 className="text-base font-medium mb-3">Video Details</h4>
      
      <div>
        <Label htmlFor={`video-title-${videoId}`}>Name</Label>
        <Input
          type="text"
          id={`video-title-${videoId}`}
          placeholder="Enter video title"
          value={metadata.title}
          onChange={(e) => updateMetadata(videoId, 'title', e.target.value)}
          required
        />
      </div>
      
      <div>
        <Label htmlFor={`video-description-${videoId}`}>Description</Label>
        <Textarea
          id={`video-description-${videoId}`}
          placeholder="Enter video description"
          value={metadata.description}
          onChange={(e) => updateMetadata(videoId, 'description', e.target.value)}
        />
      </div>
      
      <div>
        <Label htmlFor={`classification-${videoId}`}>How would you classify this?</Label>
        <Select 
          value={metadata.classification} 
          onValueChange={(value) => updateMetadata(videoId, 'classification', value as 'art' | 'gen')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="art">Art</SelectItem>
            <SelectItem value="gen">Gen</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default VideoMetadataForm;
