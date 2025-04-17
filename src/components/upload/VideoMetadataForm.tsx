import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from "@/components/ui/card";
import { LoraMultiSelectCombobox } from '@/components/upload/LoraMultiSelectCombobox';
import { Button } from '@/components/ui/button';
import { Link } from 'lucide-react';

type LoraOption = {
  id: string;
  name: string;
};

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
  associatedLoraIds: string[];
  availableLoras: LoraOption[];
  onMetadataChange: (id: string, field: string, value: any) => void;
  allowPrimarySelection?: boolean;
  disabled?: boolean;
  uploadContext: 'lora' | 'video';
  totalVideoCount: number;
  onApplyLorasToAll?: (loraIds: string[]) => void;
}

const VideoMetadataForm: React.FC<VideoMetadataFormProps> = ({ 
  videoId, 
  metadata, 
  associatedLoraIds,
  availableLoras, 
  onMetadataChange, 
  allowPrimarySelection = true,
  disabled = false,
  uploadContext,
  totalVideoCount,
  onApplyLorasToAll,
}) => {
  const { user } = useAuth();
  
  const showApplyToAll = 
    uploadContext === 'video' &&
    totalVideoCount > 1 && 
    associatedLoraIds.length > 0 && 
    typeof onApplyLorasToAll === 'function';
  
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
                onChange={(e) => onMetadataChange(videoId, 'title', e.target.value)}
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
                onChange={(e) => onMetadataChange(videoId, 'description', e.target.value)}
                disabled={disabled}
                className="min-h-[80px]"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Conditionally render LoRA Association based on context */}
              {uploadContext === 'video' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">
                    Which LoRA did you make this with? (Optional)
                  </Label>
                  <LoraMultiSelectCombobox
                    loras={availableLoras}
                    selectedIds={associatedLoraIds}
                    setSelectedIds={(ids) => {
                      console.log(`[VideoMetadataForm] setSelectedIds callback received. Video ID: ${videoId}, New IDs:`, ids);
                      console.log(`[VideoMetadataForm] Current associatedLoraIds before update:`, associatedLoraIds); 
                      
                      onMetadataChange(videoId, 'associatedLoraIds', ids);
                      
                      console.log(`[VideoMetadataForm] Called onMetadataChange for 'associatedLoraIds'.`);
                    }}
                    disabled={disabled || availableLoras.length === 0}
                    placeholder="Select LoRA(s)..."
                    searchPlaceholder="Search LoRAs..."
                    noResultsText="No LoRAs found."
                    triggerClassName="min-h-[58px]"
                  />
                  {availableLoras.length === 0 && !disabled && (
                    <p className="text-xs text-muted-foreground mt-1">No LoRAs available to select.</p>
                  )}

                  {showApplyToAll && (
                    <Button
                      variant="link"
                      size="sm"
                      type="button"
                      className="mt-2 px-0 h-auto text-muted-foreground hover:text-primary"
                      onClick={() => onApplyLorasToAll(associatedLoraIds)}
                      disabled={disabled}
                    >
                      <Link size={14} className="mr-1.5" />
                      Apply selected LoRA(s) to all {totalVideoCount} videos
                    </Button>
                  )}
                </div>
              )}

              <div>
                <Label className="text-sm font-medium mb-2 block">Video Classification</Label>
                <RadioGroup 
                  value={metadata.classification}
                  onValueChange={(value) => onMetadataChange(videoId, 'classification', value)}
                  className="flex flex-col space-y-2"
                  disabled={disabled}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gen" id={`classification-gen-${videoId}`} />
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
          
          {allowPrimarySelection && (
            <div className="pt-2">
              <div className="flex items-center space-x-3">
                <Switch
                  id={`is-primary-${videoId}`}
                  checked={metadata.isPrimary}
                  onCheckedChange={(checked) => onMetadataChange(videoId, 'isPrimary', checked)}
                  disabled={disabled}
                />
                <Label htmlFor={`is-primary-${videoId}`} className="font-medium cursor-pointer">
                  Use as primary media for this LoRA
                </Label>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoMetadataForm;
