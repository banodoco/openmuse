
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface LoRADetailsFormProps {
  videoId: string;
  metadata: {
    loraName: string;
    loraDescription: string;
    baseModel: string;
    modelVariant?: string;
    trainingSteps: string;
    resolution: string;
    trainingDataset: string;
    creator?: string;
  };
  updateMetadata: (id: string, field: string, value: any) => void;
  disabled?: boolean;
}

const LoRADetailsForm: React.FC<LoRADetailsFormProps> = ({ 
  videoId, 
  metadata, 
  updateMetadata, 
  disabled = false 
}) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">Basic Information</h4>
            
            <div className="grid gap-4">
              <div>
                <Label htmlFor={`lora-name-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  LoRA Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  id={`lora-name-${videoId}`}
                  placeholder="Enter LoRA name"
                  value={metadata.loraName}
                  onChange={(e) => updateMetadata(videoId, 'loraName', e.target.value)}
                  disabled={disabled}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor={`lora-description-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  LoRA Description
                </Label>
                <Textarea
                  id={`lora-description-${videoId}`}
                  placeholder="Enter LoRA description"
                  value={metadata.loraDescription}
                  onChange={(e) => updateMetadata(videoId, 'loraDescription', e.target.value)}
                  disabled={disabled}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-foreground">Technical Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`base-model-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  Base Model
                </Label>
                <Input
                  type="text"
                  id={`base-model-${videoId}`}
                  placeholder="Enter base model"
                  value={metadata.baseModel}
                  onChange={(e) => updateMetadata(videoId, 'baseModel', e.target.value)}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <Label htmlFor={`model-variant-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  Model Variant
                </Label>
                <Input
                  type="text"
                  id={`model-variant-${videoId}`}
                  placeholder="Enter model variant"
                  value={metadata.modelVariant || ''}
                  onChange={(e) => updateMetadata(videoId, 'modelVariant', e.target.value)}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <Label htmlFor={`training-steps-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  Training Steps
                </Label>
                <Input
                  type="text"
                  id={`training-steps-${videoId}`}
                  placeholder="Enter training steps"
                  value={metadata.trainingSteps}
                  onChange={(e) => updateMetadata(videoId, 'trainingSteps', e.target.value)}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <Label htmlFor={`resolution-${videoId}`} className="text-sm font-medium mb-1.5 block">
                  Resolution
                </Label>
                <Input
                  type="text"
                  id={`resolution-${videoId}`}
                  placeholder="e.g., 512x512"
                  value={metadata.resolution}
                  onChange={(e) => updateMetadata(videoId, 'resolution', e.target.value)}
                  disabled={disabled}
                />
              </div>

              {metadata.creator && (
                <div>
                  <Label htmlFor={`creator-${videoId}`} className="text-sm font-medium mb-1.5 block">
                    Creator
                  </Label>
                  <Input
                    type="text"
                    id={`creator-${videoId}`}
                    placeholder="Creator name"
                    value={metadata.creator || ''}
                    onChange={(e) => updateMetadata(videoId, 'creator', e.target.value)}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor={`training-dataset-${videoId}`} className="text-sm font-medium mb-1.5 block">
              Training Dataset
            </Label>
            <Textarea
              id={`training-dataset-${videoId}`}
              placeholder="Enter training dataset details"
              value={metadata.trainingDataset}
              onChange={(e) => updateMetadata(videoId, 'trainingDataset', e.target.value)}
              disabled={disabled}
              className="min-h-[80px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoRADetailsForm;
