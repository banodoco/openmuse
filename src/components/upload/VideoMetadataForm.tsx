
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VideoMetadataFormProps {
  videoId: string;
  metadata: {
    title: string;
    description: string;
    creator: 'self' | 'someone_else';
    creatorName: string;
    classification: 'art' | 'gen';
    model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
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
        <Label className="block mb-2">Was this made by you or someone else?</Label>
        <RadioGroup 
          value={metadata.creator}
          onValueChange={(value) => updateMetadata(videoId, 'creator', value)}
          className="flex flex-col space-y-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id={`creator-self-${videoId}`} />
            <Label htmlFor={`creator-self-${videoId}`}>Self</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="someone_else" id={`creator-someone-${videoId}`} />
            <Label htmlFor={`creator-someone-${videoId}`}>Someone else</Label>
          </div>
        </RadioGroup>
      </div>
      
      {metadata.creator === 'someone_else' && (
        <div>
          <Label htmlFor={`creator-name-${videoId}`}>Who?</Label>
          <Input
            type="text"
            id={`creator-name-${videoId}`}
            placeholder="Enter creator's name"
            value={metadata.creatorName}
            onChange={(e) => updateMetadata(videoId, 'creatorName', e.target.value)}
            required={metadata.creator === 'someone_else'}
          />
        </div>
      )}
      
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

      <div>
        <Label htmlFor={`model-${videoId}`}>Model</Label>
        <Select 
          value={metadata.model} 
          onValueChange={(value) => updateMetadata(videoId, 'model', value as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select Model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wan">Wan</SelectItem>
            <SelectItem value="hunyuan">Hunyuan</SelectItem>
            <SelectItem value="ltxv">LTXV</SelectItem>
            <SelectItem value="cogvideox">CogVideoX</SelectItem>
            <SelectItem value="animatediff">AnimateDiff</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default VideoMetadataForm;
