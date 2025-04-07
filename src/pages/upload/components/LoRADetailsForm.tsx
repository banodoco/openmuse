
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LoRADetailsFormProps {
  loraDetails: {
    loraName: string;
    loraDescription: string;
    creator: 'self' | 'someone_else';
    creatorName: string;
    model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
    loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Other';
    loraLink: string;
  };
  updateLoRADetails: (field: string, value: string) => void;
  disabled?: boolean;
}

const LoRADetailsForm: React.FC<LoRADetailsFormProps> = ({ 
  loraDetails, 
  updateLoRADetails, 
  disabled = false 
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Basic Information</h3>
        <div>
          <Label htmlFor="lora-name" className="text-sm font-medium">
            LoRA Name <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            id="lora-name"
            placeholder="Enter LoRA name"
            value={loraDetails.loraName}
            onChange={(e) => updateLoRADetails('loraName', e.target.value)}
            className="mt-1"
            required
            disabled={disabled}
          />
        </div>
        
        <div>
          <Label htmlFor="lora-description" className="text-sm font-medium">
            LoRA Description
          </Label>
          <Textarea
            id="lora-description"
            placeholder="Enter LoRA description"
            value={loraDetails.loraDescription}
            onChange={(e) => updateLoRADetails('loraDescription', e.target.value)}
            className="mt-1 min-h-[100px]"
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Creator Information</h3>
        
        <div>
          <Label className="text-sm font-medium block mb-2">
            Who made this LoRA?
          </Label>
          <RadioGroup 
            value={loraDetails.creator}
            onValueChange={(value: 'self' | 'someone_else') => updateLoRADetails('creator', value)}
            className="flex flex-col space-y-2"
            disabled={disabled}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="self" id="lora-creator-self" />
              <Label htmlFor="lora-creator-self" className="cursor-pointer">I made it</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="someone_else" id="lora-creator-someone" />
              <Label htmlFor="lora-creator-someone" className="cursor-pointer">Someone else made it</Label>
            </div>
          </RadioGroup>
        </div>

        {loraDetails.creator === 'someone_else' && (
          <div>
            <Label htmlFor="creator-name" className="text-sm font-medium">
              Creator Username <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              id="creator-name"
              placeholder="Username of the creator"
              value={loraDetails.creatorName}
              onChange={(e) => updateLoRADetails('creatorName', e.target.value)}
              className="mt-1"
              required
              disabled={disabled}
            />
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Technical Details</h3>
        
        <div>
          <Label htmlFor="lora-model" className="text-sm font-medium">
            Which model was this trained on? <span className="text-destructive">*</span>
          </Label>
          <Select 
            value={loraDetails.model} 
            onValueChange={(value: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff') => updateLoRADetails('model', value)}
            disabled={disabled}
          >
            <SelectTrigger id="lora-model" className="w-full mt-1">
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
          <Label htmlFor="lora-type" className="text-sm font-medium">
            What type of LoRA is this? <span className="text-destructive">*</span>
          </Label>
          <Select 
            value={loraDetails.loraType} 
            onValueChange={(value) => updateLoRADetails('loraType', value)}
            disabled={disabled}
          >
            <SelectTrigger id="lora-type" className="w-full mt-1">
              <SelectValue placeholder="Select LoRA type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Concept">Concept</SelectItem>
              <SelectItem value="Motion Style">Motion Style</SelectItem>
              <SelectItem value="Specific Movement">Specific Movement</SelectItem>
              <SelectItem value="Aesthetic Style">Aesthetic Style</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="lora-link" className="text-sm font-medium">
            LoRA Link (Huggingface, Civit, etc.)
          </Label>
          <Input
            type="url"
            id="lora-link"
            placeholder="Enter LoRA link"
            value={loraDetails.loraLink}
            onChange={(e) => updateLoRADetails('loraLink', e.target.value)}
            className="mt-1"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default LoRADetailsForm;
