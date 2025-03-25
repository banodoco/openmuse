
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  baseModel: string;
  trainingSteps: string;
  resolution: string;
  trainingDataset: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff'; // Ensure this matches the types in the VideoMetadata interface
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
          <Label className="block mb-2">Was this made by you or someone else?</Label>
          <RadioGroup 
            value={loraDetails.creator}
            onValueChange={(value) => updateLoRADetails('creator', value)}
            className="flex flex-col space-y-1"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="self" id="lora-creator-self" />
              <Label htmlFor="lora-creator-self">Me</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="someone_else" id="lora-creator-someone" />
              <Label htmlFor="lora-creator-someone">Someone else</Label>
            </div>
          </RadioGroup>
        </div>
        
        {loraDetails.creator === 'someone_else' && (
          <div>
            <Label htmlFor="lora-creator-name">Who?</Label>
            <Input
              type="text"
              id="lora-creator-name"
              placeholder="Enter creator's name"
              value={loraDetails.creatorName}
              onChange={(e) => updateLoRADetails('creatorName', e.target.value)}
              required={loraDetails.creator === 'someone_else'}
            />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
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
        
        <div>
          <Label htmlFor="lora-model">Which model was this trained on?</Label>
          <Select 
            value={loraDetails.model} 
            onValueChange={(value: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff') => updateLoRADetails('model', value)}
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
