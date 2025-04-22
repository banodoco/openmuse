import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from "@/components/ui/card";
import { LoraMultiSelectCombobox } from '@/components/upload/LoraMultiSelectCombobox';

type LoraOption = {
  id: string;
  name: string;
}

interface VideoMetadataFormProps {
  videoId: string;
  metadata: {
    title: string;
    description: string;
    classification: 'art' | 'gen'; // Expects 'gen'
    isPrimary?: boolean;
    associatedLoraIds?: string[]; // Add associated Lora IDs here too if not inferred
  };
  updateMetadata: (id: string, field: string, value: any) => void; // Expects this prop
  canSetPrimary?: boolean;
  disabled?: boolean;
  showLoraSelector?: boolean;
  availableLoras?: LoraOption[];
}

const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ 
  videoId, 
  metadata, 
  updateMetadata, 
  canSetPrimary = true,
  disabled = false,
  showLoraSelector = false, 
  availableLoras = [], 
}) => {
  const { user } = useAuth();
  
  // Handler specifically for the LoRA selector within this form
  const handleLoraSelectionChange = (selectedIds: string[]) => {
    updateMetadata(videoId, 'associatedLoraIds', selectedIds);
  };

  // Extract selected IDs from metadata, default to empty array
  const associatedLoraIds = metadata.associatedLoraIds || [];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Video Details</h3>
            
            <div>
              <Label htmlFor={`title-${videoId}`} className="text-sm font-medium mb-1.5 block">
                Title
              </Label>
              <Input
                type="text"
                id={`title-${videoId}`}
                placeholder="Optional video title"
                value={metadata.title}
                onChange={(e) => updateMetadata(videoId, 'title', e.target.value)}
                disabled={disabled}
              />
            </div>
            
            <div>
              <Label htmlFor={`description-${videoId}`} className="text-sm font-medium mb-1.5 block">
                Description
              </Label>
              <Textarea
                id={`description-${videoId}`}
                placeholder="Optional video description"
                value={metadata.description}
                onChange={(e) => updateMetadata(videoId, 'description', e.target.value)}
                disabled={disabled}
                className="min-h-[80px]"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Classification</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm font-medium mb-2 block">Video Classification</Label>
                <RadioGroup 
                  value={metadata.classification}
                  onValueChange={(value) => updateMetadata(videoId, 'classification', value)}
                  className="flex flex-col space-y-2"
                  disabled={disabled}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gen" id={`classification-gen-${videoId}`} /> {/* Uses 'gen' */}
                    <Label htmlFor={`classification-gen-${videoId}`} className="cursor-pointer">Generation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="art" id={`classification-art-${videoId}`} />
                    <Label htmlFor={`classification-art-${videoId}`} className="cursor-pointer">Artwork</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>
          
          {canSetPrimary && (
            <div className="pt-2">
              <div className="flex items-center space-x-3">
                <Switch
                  id={`is-primary-${videoId}`}
                  checked={metadata.isPrimary}
                  onCheckedChange={(checked) => updateMetadata(videoId, 'isPrimary', checked)}
                  disabled={disabled}
                />
                <Label htmlFor={`is-primary-${videoId}`} className="font-medium cursor-pointer">
                  Use as primary media for this LoRA
                </Label>
              </div>
            </div>
          )}

          {showLoraSelector && (
            <div className="pt-4 border-t border-border/40">
              <Label className="text-sm font-medium mb-2 block">Which LoRA was this created with?</Label>
              <LoraMultiSelectCombobox 
                loras={availableLoras}
                selectedIds={associatedLoraIds}
                setSelectedIds={handleLoraSelectionChange}
                disabled={disabled}
              />
              {/* Add validation message area if needed */} 
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoMetadataForm;
