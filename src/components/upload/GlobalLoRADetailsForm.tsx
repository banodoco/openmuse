
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  creatorOrigin?: string;
  model: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff';
  loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraLink: string;
}

interface GlobalLoRADetailsFormProps {
  loraDetails: LoRADetailsForm;
  updateLoRADetails: (field: keyof LoRADetailsForm, value: string) => void;
  disabled?: boolean;
}

const GlobalLoRADetailsForm: React.FC<GlobalLoRADetailsFormProps> = ({ 
  loraDetails, 
  updateLoRADetails,
  disabled = false
}) => {
  const { user } = useAuth();
  
  // Always set creator to 'self' when user is logged in
  React.useEffect(() => {
    if (user) {
      updateLoRADetails('creator', 'self');
    }
  }, [user]);

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
            disabled={disabled}
          />
        </div>
        
        <div>
          <Label htmlFor="lora-description">LoRA Description</Label>
          <Textarea
            id="lora-description"
            placeholder="Enter LoRA description"
            value={loraDetails.loraDescription}
            onChange={(e) => updateLoRADetails('loraDescription', e.target.value)}
            disabled={disabled}
          />
        </div>

        <div>
          <Label>Who made this LoRA?</Label>
          <RadioGroup 
            value={loraDetails.creator}
            onValueChange={(value) => updateLoRADetails('creator', value)}
            className="flex flex-col space-y-1"
            disabled={disabled}
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
            <Label htmlFor="creator-name">Their username:</Label>
            <Input
              type="text"
              id="creator-name"
              placeholder="naughtyhamster69"
              value={loraDetails.creatorName}
              onChange={(e) => updateLoRADetails('creatorName', e.target.value)}
              required
              disabled={disabled}
            />
          </div>
        )}

        <div>
          <Label htmlFor="lora-type">What type of LoRA is this?</Label>
          <Select 
            value={loraDetails.loraType} 
            onValueChange={(value) => updateLoRADetails('loraType', value)}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select LoRA type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Concept">Concept</SelectItem>
              <SelectItem value="Motion Style">Motion Style</SelectItem>
              <SelectItem value="Specific Movement">Specific Movement</SelectItem>
              <SelectItem value="Aesthetic Style">Aesthetic Style</SelectItem>
              <SelectItem value="Control">Control</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="lora-link">Please share a link (Huggingface, Civit, etc.)</Label>
          <Input
            type="url"
            id="lora-link"
            placeholder="Enter LoRA link"
            value={loraDetails.loraLink}
            onChange={(e) => updateLoRADetails('loraLink', e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <Label htmlFor="lora-model">Which model was this trained on?</Label>
          <Select 
            value={loraDetails.model} 
            onValueChange={(value: 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff') => updateLoRADetails('model', value)}
            disabled={disabled}
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
    </div>
  );
};

export default GlobalLoRADetailsForm;
