import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TextareaAutosize from 'react-textarea-autosize';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Info, CheckSquare } from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from "@/components/ui/checkbox";

interface ModelData {
  id: string;
  internal_identifier: string;
  display_name: string;
  variants: string[];
  default_variant?: string | null;
}

interface LoRADetailsForm {
  loraName: string;
  loraDescription: string;
  creator: 'self' | 'someone_else';
  creatorName: string;
  creatorOrigin?: string;
  model: string;
  modelVariant: string;
  loraType: 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other';
  loraStorageMethod: 'upload' | 'link';
  loraLink: string;
  huggingFaceApiKey?: string;
  loraDirectDownloadLink?: string;
  saveApiKey: boolean;
}

interface GlobalLoRADetailsFormProps {
  loraDetails: LoRADetailsForm;
  updateLoRADetails: (field: keyof LoRADetailsForm, value: string | boolean) => void;
  onLoraFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

const GlobalLoRADetailsForm: React.FC<GlobalLoRADetailsFormProps> = ({ 
  loraDetails, 
  updateLoRADetails,
  onLoraFileSelect,
  disabled = false
}) => {
  const { user } = useAuth();
  const [availableModels, setAvailableModels] = useState<ModelData[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  
  // Preload the tooltip image
  useEffect(() => {
    const img = new Image();
    img.src = '/write_access.png';
  }, []);
  
  // Fetch models from Supabase on component mount
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      const { data, error } = await supabase
        .from('models')
        .select('id, internal_identifier, display_name, variants, default_variant')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('display_name', { ascending: true });

      if (error) {
        console.error("Error fetching models:", error);
        // Handle error appropriately, e.g., show a toast message
      } else if (data) {
        setAvailableModels(data as ModelData[]);
      }
      setIsLoadingModels(false);
    };

    fetchModels();
  }, []);

  // Check for existing API key
  useEffect(() => {
    const checkExistingApiKey = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('service', 'huggingface')
        .single();

      setHasExistingApiKey(!!data && !error);
    };

    checkExistingApiKey();
  }, [user]);

  // Effect to initialize or update model and variant when availableModels are loaded
  // or if loraDetails.model prop changes (for edit scenarios - though less critical here)
  useEffect(() => {
    if (availableModels.length > 0 && !isLoadingModels) {
      const currentModelIsValid = availableModels.some(m => m.internal_identifier === loraDetails.model);
      if (!loraDetails.model || !currentModelIsValid) {
        // If no model is set, or current model is not in the fetched list, set to the first available
        const firstModel = availableModels[0];
        updateLoRADetails('model', firstModel.internal_identifier);
        const initialVariant = firstModel.default_variant || (firstModel.variants.length > 0 ? firstModel.variants[0] : '');
        updateLoRADetails('modelVariant', initialVariant);
      } else {
        // Current model is valid, ensure variant is also valid for this model
        const selectedModelData = availableModels.find(m => m.internal_identifier === loraDetails.model);
        if (selectedModelData && !selectedModelData.variants.includes(loraDetails.modelVariant)) {
          const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
          updateLoRADetails('modelVariant', newVariant);
        }
      }
    }
  }, [availableModels, isLoadingModels, loraDetails.model, updateLoRADetails]);

  // Update model variant when model selection changes by the user
  useEffect(() => {
    if (!isLoadingModels && availableModels.length > 0 && loraDetails.model) {
      const selectedModelData = availableModels.find(m => m.internal_identifier === loraDetails.model);
      if (selectedModelData) {
        // Check if the current variant is valid for the new model
        // This check is important if the model was changed programmatically or by prop update
        if (!selectedModelData.variants.includes(loraDetails.modelVariant)) {
            const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
            // Only update if the model itself is a valid one from the list
            // This prevents resetting variant if loraDetails.model is temporarily out of sync during initial load
            if (availableModels.some(m => m.internal_identifier === loraDetails.model)) {
                 updateLoRADetails('modelVariant', newVariant);
            }
        }
      } else {
        // If the selected model is not found (e.g. during intermediate state or error)
        // It might be safer to not change the variant, or clear it, based on desired UX.
        // For now, we let the previous effect handle setting a default if model becomes invalid.
      }
    }
  // Removed loraDetails.modelVariant from dependency array to avoid potential loops
  // The variant should only be auto-updated when the *model* changes.
  }, [loraDetails.model, availableModels, isLoadingModels, updateLoRADetails]);
  
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
            <div>
              <Label htmlFor="lora-name" className="text-sm font-medium mb-1.5 block">
                LoRA Name <span className="text-destructive">*</span>
              </Label>
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
              <Label htmlFor="lora-description" className="text-sm font-medium mb-1.5 block">
                LoRA Description
              </Label>
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <TextareaAutosize
                  id="lora-description"
                  placeholder="Describe the LoRA, how to trigger it (e.g., trigger words, prompt structure), and any tips for best results."
                  value={loraDetails.loraDescription}
                  onChange={(e) => updateLoRADetails('loraDescription', e.target.value)}
                  disabled={disabled}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  minRows={4}
                />
                <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground space-y-2 w-full sm:w-auto sm:min-w-[180px]">
                  <p className="font-medium">Remember to include:</p>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" /> <span>General Description</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" /> <span>Prompt Structure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-green-600 flex-shrink-0" /> <span>Best Practices</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Creator Information</h3>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">
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
                  <Label htmlFor="lora-creator-self" className="cursor-pointer">Me</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="someone_else" id="lora-creator-someone" />
                  <Label htmlFor="lora-creator-someone" className="cursor-pointer">Someone else</Label>
                </div>
              </RadioGroup>
            </div>

            {loraDetails.creator === 'someone_else' && (
              <div>
                <Label htmlFor="creator-name" className="text-sm font-medium mb-1.5 block">
                  Creator Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="text"
                  id="creator-name"
                  placeholder="Username of the creator"
                  value={loraDetails.creatorName}
                  onChange={(e) => updateLoRADetails('creatorName', e.target.value)}
                  required
                  disabled={disabled}
                />
              </div>
            )}
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Technical Details</h3>
            
            <div>
              <Label htmlFor="lora-model" className="text-sm font-medium mb-1.5 block">
                Which model was this trained on? <span className="text-destructive">*</span>
              </Label>
              <Select 
                value={loraDetails.model}
                onValueChange={(value) => {
                  updateLoRADetails('model', value);
                  // When model changes, find its variants and set the default/first
                  const selectedModelData = availableModels.find(m => m.internal_identifier === value);
                  if (selectedModelData) {
                    const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
                    updateLoRADetails('modelVariant', newVariant);
                  }
                }}
                disabled={disabled || isLoadingModels}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={isLoadingModels ? "Loading models..." : "Select Model"} />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.internal_identifier}>
                      {model.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="model-variant" className="text-sm font-medium mb-1.5 block">
                Model Variant <span className="text-destructive">*</span>
              </Label>
              {(() => {
                const selectedModelData = availableModels.find(m => m.internal_identifier === loraDetails.model);
                const variants = selectedModelData ? selectedModelData.variants : [];
                if (isLoadingModels || !selectedModelData) {
                  return (
                    <Input
                      type="text"
                      id="model-variant-disabled"
                      placeholder={isLoadingModels ? "Loading..." : "Select model first"}
                      value={loraDetails.modelVariant}
                      disabled={true}
                    />
                  );
                }
                return (
                  <Select 
                    value={loraDetails.modelVariant}
                    onValueChange={(value) => updateLoRADetails('modelVariant', value)}
                    disabled={disabled || variants.length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={variants.length === 0 ? "No variants" : "Select Variant"} />
                    </SelectTrigger>
                    <SelectContent>
                      {variants.map(variant => (
                        <SelectItem key={variant} value={variant}>{variant}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            
            <div>
              <Label htmlFor="lora-type" className="text-sm font-medium mb-1.5 block">
                What type of LoRA is this? <span className="text-destructive">*</span>
              </Label>
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
              <Label className="text-sm font-medium mb-2 block">
                How do you want to store this LoRA? <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={loraDetails.loraStorageMethod}
                onValueChange={(value: 'upload' | 'link') => {
                  updateLoRADetails('loraStorageMethod', value);
                  // Reset the other field when switching
                  if (value === 'upload') {
                    updateLoRADetails('loraLink', '');
                    updateLoRADetails('loraDirectDownloadLink', '');
                  }
                  if (value === 'link') updateLoRADetails('huggingFaceApiKey', '');
                }}
                className="flex flex-col space-y-2 mb-4"
                disabled={disabled}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="link" id="lora-storage-link" />
                  <Label htmlFor="lora-storage-link" className="cursor-pointer">Share Link</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="lora-storage-upload" />
                  <Label htmlFor="lora-storage-upload" className="cursor-pointer">Upload</Label>
                </div>
              </RadioGroup>
            </div>

            {loraDetails.loraStorageMethod === 'link' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <Label htmlFor="lora-link" className="text-sm font-medium block">
                      LoRA Link (Huggingface, Civit, etc.)
                      {!(loraDetails.loraDirectDownloadLink && loraDetails.loraDirectDownloadLink.trim() !== '') && <span className="text-destructive"> *</span>}
                    </Label>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>We are too poor to host models. Ideally, host on Huggingface because it's easier to download from.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="url"
                    id="lora-link"
                    placeholder="https://huggingface.co/user/model"
                    value={loraDetails.loraLink}
                    onChange={(e) => updateLoRADetails('loraLink', e.target.value)}
                    required={loraDetails.loraStorageMethod === 'link'}
                    disabled={disabled}
                  />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5 mb-1.5">
                    <Label htmlFor="lora-direct-download-link" className="text-sm font-medium block">
                      Direct Download Link
                    </Label>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <p>A link where a user can download the LoRA directly.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    type="url"
                    id="lora-direct-download-link"
                    placeholder="https://example.com/lora.safetensors"
                    value={loraDetails.loraDirectDownloadLink || ''}
                    onChange={(e) => updateLoRADetails('loraDirectDownloadLink', e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>
            )}

            {loraDetails.loraStorageMethod === 'upload' && (
              <div>
                {hasExistingApiKey ? (
                  <div className="text-sm text-muted-foreground mb-4">
                    We'll upload it to your HuggingFace account - you can change this on your profile
                  </div>
                ) : (
                  <>
                    <Label htmlFor="huggingface-api-key" className="text-sm font-medium mb-1.5 block">
                      HuggingFace API Key <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="password"
                      id="huggingface-api-key"
                      name="huggingface-api-key"
                      autoComplete="on"
                      placeholder="Enter your HuggingFace API Key (write access)"
                      value={loraDetails.huggingFaceApiKey || ''}
                      onChange={(e) => updateLoRADetails('huggingFaceApiKey', e.target.value)}
                      required={loraDetails.loraStorageMethod === 'upload'}
                      disabled={disabled}
                    />
                    <div className="flex items-center space-x-2 mt-2">
                      <Checkbox
                        id="save-api-key"
                        checked={loraDetails.saveApiKey}
                        onCheckedChange={(checked) => updateLoRADetails('saveApiKey', checked)}
                        disabled={disabled}
                      />
                      <Label htmlFor="save-api-key" className="text-sm text-muted-foreground">
                        Save API Key for future uploads
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      You can create your Hugging Face API token{' '}
                      <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-olive hover:text-olive-dark underline"
                      >
                        here
                      </a>
                      . You will need to give it{' '}
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="underline cursor-help font-medium">personal namespace write access</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-0 border-none shadow-lg bg-transparent">
                            <img src="/write_access.png" alt="Hugging Face API token write access permission example" className="max-w-md rounded" />
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      .
                    </p>
                  </>
                )}
                <div className="mt-4">
                  <Label htmlFor="lora-file-upload" className="text-sm font-medium mb-1.5 block">
                    LoRA File (.safetensors, .bin, etc.) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="file"
                    id="lora-file-upload"
                    onChange={(e) => onLoraFileSelect(e.target.files ? e.target.files[0] : null)}
                    disabled={disabled}
                    required={loraDetails.loraStorageMethod === 'upload'}
                    accept=".safetensors,.bin,.pt,.ckpt"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GlobalLoRADetailsForm;
