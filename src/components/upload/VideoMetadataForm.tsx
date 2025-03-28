
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Star } from 'lucide-react';

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
}

const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ 
  videoId, 
  metadata, 
  updateMetadata,
  canSetPrimary = true
}) => {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`title-${videoId}`}>Title</Label>
        <Input
          id={`title-${videoId}`}
          value={metadata.title}
          onChange={(e) => updateMetadata(videoId, 'title', e.target.value)}
          placeholder="Enter a title for this video"
        />
      </div>
      
      <div>
        <Label htmlFor={`description-${videoId}`}>Description</Label>
        <Textarea
          id={`description-${videoId}`}
          value={metadata.description}
          onChange={(e) => updateMetadata(videoId, 'description', e.target.value)}
          placeholder="Enter a description for this video"
          rows={3}
        />
      </div>
      
      <div>
        <Label htmlFor={`classification-${videoId}`}>Type</Label>
        <Select
          value={metadata.classification}
          onValueChange={(value) => updateMetadata(videoId, 'classification', value)}
        >
          <SelectTrigger id={`classification-${videoId}`}>
            <SelectValue placeholder="Select the type of video" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="gen">AI Generation</SelectItem>
              <SelectItem value="art">Original Art</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      
      <div>
        <Label>Creator</Label>
        <RadioGroup
          value={metadata.creator}
          onValueChange={(value) => updateMetadata(videoId, 'creator', value)}
          className="flex flex-col space-y-1 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id={`self-${videoId}`} />
            <Label htmlFor={`self-${videoId}`} className="font-normal">I created this</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="someone_else" id={`someone-${videoId}`} />
            <Label htmlFor={`someone-${videoId}`} className="font-normal">Someone else created this</Label>
          </div>
        </RadioGroup>
      </div>
      
      {metadata.creator === 'someone_else' && (
        <div>
          <Label htmlFor={`creator-name-${videoId}`}>Creator Name</Label>
          <Input
            id={`creator-name-${videoId}`}
            value={metadata.creatorName}
            onChange={(e) => updateMetadata(videoId, 'creatorName', e.target.value)}
            placeholder="Enter the creator's name"
          />
        </div>
      )}
      
      {canSetPrimary && (
        <div className="flex items-center space-x-2 pt-2">
          <Checkbox
            id={`primary-${videoId}`}
            checked={metadata.isPrimary}
            onCheckedChange={(checked) => updateMetadata(videoId, 'isPrimary', checked)}
          />
          <div className="flex items-center gap-1">
            <Star className={`h-4 w-4 ${metadata.isPrimary ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
            <Label 
              htmlFor={`primary-${videoId}`}
              className="font-normal text-sm"
            >
              Set as primary media for this LoRA
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMetadataForm;
