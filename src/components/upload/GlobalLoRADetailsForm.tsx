
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  baseModel: string;
  trainingSteps: string;
  resolution: string;
  trainingDataset: string;
}

interface GlobalLoRADetailsFormProps {
  loraDetails: LoRADetailsForm;
  updateLoRADetails: (field: keyof LoRADetailsForm, value: string) => void;
}

const GlobalLoRADetailsForm: React.FC<GlobalLoRADetailsFormProps> = ({ 
  loraDetails, 
  updateLoRADetails 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="lora-name">LoRA Name</Label>
          <Input
            type="text"
            id="lora-name"
            placeholder="Enter LoRA name"
            value={loraDetails.loraName}
            onChange={(e) => updateLoRADetails('loraName', e.target.value)}
            required
          />
        </div>
        
        <div>
          <Label htmlFor="lora-description">LoRA Description</Label>
          <Textarea
            id="lora-description"
            placeholder="Enter LoRA description"
            value={loraDetails.loraDescription}
            onChange={(e) => updateLoRADetails('loraDescription', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="base-model">Base Model</Label>
          <Input
            type="text"
            id="base-model"
            placeholder="Enter base model"
            value={loraDetails.baseModel}
            onChange={(e) => updateLoRADetails('baseModel', e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="training-steps">Training Steps</Label>
          <Input
            type="text"
            id="training-steps"
            placeholder="Enter training steps"
            value={loraDetails.trainingSteps}
            onChange={(e) => updateLoRADetails('trainingSteps', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="resolution">Resolution</Label>
          <Input
            type="text"
            id="resolution"
            placeholder="e.g., 512x512"
            value={loraDetails.resolution}
            onChange={(e) => updateLoRADetails('resolution', e.target.value)}
          />
        </div>
        
        <div>
          <Label htmlFor="training-dataset">Training Dataset</Label>
          <Textarea
            id="training-dataset"
            placeholder="Enter training dataset details"
            value={loraDetails.trainingDataset}
            onChange={(e) => updateLoRADetails('trainingDataset', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default GlobalLoRADetailsForm;
