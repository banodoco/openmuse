
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';

interface VideoMetadataFormProps {
  videoId: string;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'gen';
    creator: 'self' | 'someone_else';
    creatorName: string;
    isPrimary?: boolean;
  };
  updateMetadata: (id: string, field: string, value: any) => void;
  canSetPrimary?: boolean;
  disabled?: boolean;
}

const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ 
  videoId, 
  metadata, 
  updateMetadata, 
  canSetPrimary = true,
  disabled = false
}) => {
  const { user } = useAuth();
  
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`title-${videoId}`}>Title</Label>
        <Input
          type="text"
          id={`title-${videoId}`}
          placeholder="Enter video title"
          value={metadata.title}
          onChange={(e) => updateMetadata(videoId, 'title', e.target.value)}
          required
          disabled={disabled}
        />
      </div>
      
      <div>
        <Label htmlFor={`description-${videoId}`}>Description</Label>
        <Textarea
          id={`description-${videoId}`}
          placeholder="Enter video description"
          value={metadata.description}
          onChange={(e) => updateMetadata(videoId, 'description', e.target.value)}
          disabled={disabled}
        />
      </div>
      
      <div>
        <Label className="block mb-2">Classification</Label>
        <RadioGroup 
          value={metadata.classification}
          onValueChange={(value) => updateMetadata(videoId, 'classification', value)}
          className="flex flex-col space-y-1"
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gen" id={`classification-gen-${videoId}`} />
            <Label htmlFor={`classification-gen-${videoId}`}>Generated</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="art" id={`classification-art-${videoId}`} />
            <Label htmlFor={`classification-art-${videoId}`}>Artwork</Label>
          </div>
        </RadioGroup>
      </div>
      
      <div>
        <Label className="block mb-2">Who made this?</Label>
        <RadioGroup 
          value={metadata.creator}
          onValueChange={(value) => updateMetadata(videoId, 'creator', value)}
          className="flex flex-col space-y-1"
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id={`creator-self-${videoId}`} />
            <Label htmlFor={`creator-self-${videoId}`}>You</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="someone_else" id={`creator-someone-else-${videoId}`} />
            <Label htmlFor={`creator-someone-else-${videoId}`}>Someone else</Label>
          </div>
        </RadioGroup>
      </div>
      
      {metadata.creator === 'someone_else' && (
        <div>
          <Label htmlFor={`creator-name-${videoId}`}>What's their username?</Label>
          <Input
            type="text"
            id={`creator-name-${videoId}`}
            placeholder="Enter creator's username"
            value={metadata.creatorName}
            onChange={(e) => updateMetadata(videoId, 'creatorName', e.target.value)}
            required
            disabled={disabled}
          />
        </div>
      )}
      
      {canSetPrimary && (
        <div className="flex items-center space-x-2">
          <Switch
            id={`is-primary-${videoId}`}
            checked={metadata.isPrimary}
            onCheckedChange={(checked) => updateMetadata(videoId, 'isPrimary', checked)}
            disabled={disabled}
          />
          <Label htmlFor={`is-primary-${videoId}`}>Use as primary media for this LoRA</Label>
        </div>
      )}
    </div>
  );
};

export default VideoMetadataForm;

