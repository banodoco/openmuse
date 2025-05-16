import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AssetDetails } from '../UploadPage'; // Assuming AssetDetails is exported from UploadPage or a types file
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Link2, CheckSquare } from 'lucide-react';

// Define ModelData interface (can be moved to a shared types file later)
interface ModelData {
  id: string;
  internal_identifier: string;
  display_name: string;
  variants: string[];
  default_variant?: string | null;
}

interface AssetDetailsFormProps {
  details: AssetDetails;
  updateDetails: (field: keyof AssetDetails, value: string | boolean | undefined) => void;
  assetType: 'lora' | 'workflow';
  onFileSelect: (file: File | null) => void; // Handles LoRA or Workflow file
  disabled?: boolean;
}

const AssetDetailsForm: React.FC<AssetDetailsFormProps> = ({
  details,
  updateDetails,
  assetType,
  onFileSelect,
  disabled,
}) => {
  const { user } = useAuth();
  const [hasExistingApiKey, setHasExistingApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(false);

  // State for models and variants
  const [availableModels, setAvailableModels] = useState<ModelData[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const isInitialModelSet = useRef(false); // To prevent re-setting model on every render

  // For Markdown Formatting Toolbar (LoRA Description)
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null); // To track if description is focused
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);

  // Fetch available models from Supabase
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
        toast.error("Failed to load base models for selection.");
      } else if (data) {
        setAvailableModels(data as ModelData[]);
      }
      setIsLoadingModels(false);
    };
    fetchModels();
  }, []);

  // Effect to set initial model and variant once models are loaded
  // Also handles syncing variant if model changes
  useEffect(() => {
    if (isLoadingModels || availableModels.length === 0) return;

    let currentModel = details.model;
    let currentVariant = details.modelVariant;

    if (!isInitialModelSet.current && !currentModel) {
      // Set initial model to the first available if not already set
      currentModel = availableModels[0].internal_identifier;
      updateDetails('model', currentModel);
      isInitialModelSet.current = true; // Mark as set
    }

    const selectedModelData = availableModels.find(m => m.internal_identifier === currentModel);

    if (selectedModelData) {
      if (!currentVariant || !selectedModelData.variants.includes(currentVariant)) {
        const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
        // Only update if the variant actually needs changing
        if (details.modelVariant !== newVariant) { 
            updateDetails('modelVariant', newVariant);
        }
      }
    } else if (currentModel) {
      // Selected model is not in the available list (or list is empty), clear variant
      if (details.modelVariant) updateDetails('modelVariant', undefined);
    }

  }, [details.model, details.modelVariant, availableModels, isLoadingModels, updateDetails]);

  // Effect to fetch and pre-fill HuggingFace API key for LoRA uploads
  useEffect(() => {
    if (assetType !== 'lora' || details.loraStorageMethod !== 'upload') {
      // If not a LoRA upload or not using HF, clear any API key from details if it exists
      // This is to prevent an old key from being shown if the user switches modes.
      // However, to prevent loops, only clear if it has a value AND the conditions are not met.
      if (details.huggingFaceApiKey && (assetType !== 'lora' || details.loraStorageMethod !== 'upload')) {
         // updateDetails('huggingFaceApiKey', ''); // This could cause loops if updateDetails isn't stable
      }
      setHasExistingApiKey(false); // Reset existing key status
      return;
    }

    const fetchApiKey = async () => {
      if (!user) return;
      setIsCheckingApiKey(true);
      console.log('[AssetDetailsForm] LoRA Upload mode: Attempting to fetch saved HF API key for user:', user.id);
      try {
        const { data, error } = await supabase
          .from('api_keys')
          .select('key_value')
          .eq('user_id', user.id)
          .eq('service', 'huggingface')
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('[AssetDetailsForm] Error fetching API key:', error);
          // Don't toast error here, as user might not have a key
        } else if (data && data.key_value) {
          console.log('[AssetDetailsForm] Successfully fetched API key. Updating details.');
          updateDetails('huggingFaceApiKey', data.key_value);
          setHasExistingApiKey(true);
        } else {
          console.log('[AssetDetailsForm] No saved Hugging Face API key found for this user.');
          setHasExistingApiKey(false);
          // If no key is found, and huggingFaceApiKey in details is empty, ensure it stays empty
          // If user types one, it will be in details.huggingFaceApiKey
          if (!details.huggingFaceApiKey) {
            // updateDetails('huggingFaceApiKey', ''); // Avoid loops
          }
        }
      } catch (e) {
        console.error('[AssetDetailsForm] Exception during API key fetch:', e);
        toast.error('An unexpected error occurred while fetching your API key.');
      } finally {
        setIsCheckingApiKey(false);
      }
    };

    // Only fetch if API key is not already in details (e.g. user hasn't started typing one)
    // And not currently checking.
    if (!details.huggingFaceApiKey && !isCheckingApiKey) {
        fetchApiKey();
    } else if (details.huggingFaceApiKey) {
        // If a key is already in details (e.g. user typed it or it was fetched)
        // determine if it looks like a saved one for UI purposes (e.g. to hide input if 'save' unchecked)
        // This part is tricky because we don't know if the key in `details` *is* the saved one.
        // For now, if a key exists in `details`, we assume it's either manually entered or fetched.
        // The `saveApiKey` toggle will control saving it.
    }

  // Re-run if user changes, or if they switch to lora upload method.
  // Avoid dependency on details.huggingFaceApiKey itself to prevent loops when it's updated.
  }, [user, assetType, details.loraStorageMethod, updateDetails]);

  // Helper functions for LoRA Description Markdown editor
  const handleDescriptionSelect = () => {
    if (descriptionTextareaRef.current) {
      const textarea = descriptionTextareaRef.current;
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart !== selectionEnd) {
        setSelectionRange({ start: selectionStart, end: selectionEnd });
      } else {
        setSelectionRange(null);
      }
    }
  };

  const handleDescriptionBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      // Use a more specific class name for the toolbar if needed, e.g., 'markdown-toolbar-asset-description'
      if (activeEl !== descriptionTextareaRef.current && !activeEl?.closest('.markdown-toolbar-lora-desc')) {
        if (focusedField === 'assetDescription') {
          setFocusedField(null);
        }
      }
    }, 0);
  };

  const applyMarkdownFormat = (type: 'bold' | 'italic' | 'link') => {
    if (!descriptionTextareaRef.current || !selectionRange || details.description === undefined) return;

    const textarea = descriptionTextareaRef.current;
    const { start, end } = selectionRange;
    const currentValue = details.description;
    const selectedText = currentValue.substring(start, end);
    let prefix = '';
    let suffix = '';
    let replacement = selectedText;

    switch (type) {
      case 'bold':
        prefix = '**';
        suffix = '**';
        break;
      case 'italic':
        prefix = '*';
        suffix = '*';
        break;
      case 'link':
        const url = prompt("Enter URL:", "https://");
        if (!url) return;
        prefix = '[';
        suffix = `](${url})`;
        break;
    }
    
    replacement = prefix + selectedText + suffix;
    const newValue = currentValue.substring(0, start) + replacement + currentValue.substring(end);
    
    updateDetails('description', newValue);

    setTimeout(() => {
      if (descriptionTextareaRef.current) {
        descriptionTextareaRef.current.focus();
        const newCursorPos = start + replacement.length;
        descriptionTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        handleDescriptionSelect(); 
      }
    }, 0);
    setFocusedField('assetDescription'); 
  };

  interface MarkdownFormattingToolbarProps {
    isEnabled: boolean;
    descriptionText: string | undefined;
  }

  const MarkdownFormattingToolbar: React.FC<MarkdownFormattingToolbarProps> = ({ isEnabled, descriptionText }) => {
    const effectiveIsEnabled = isEnabled && descriptionText && descriptionText.length > 0;
    const title = effectiveIsEnabled ? "" : "Highlight text in description to enable formatting.";

    return (
      <div
        className="markdown-toolbar-lora-desc absolute top-1 right-1 z-10 bg-background border rounded-md shadow-lg p-1 flex space-x-1"
        title={title}
        onMouseDown={(e) => e.preventDefault()} // Prevent blur on textarea when clicking toolbar
      >
        <Button variant="ghost" size="sm" className="p-1.5 h-auto" onClick={() => applyMarkdownFormat('bold')} disabled={!effectiveIsEnabled} title="Bold (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1.5 h-auto" onClick={() => applyMarkdownFormat('italic')} disabled={!effectiveIsEnabled} title="Italic (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="p-1.5 h-auto" onClick={() => applyMarkdownFormat('link')} disabled={!effectiveIsEnabled} title="Link (Ctrl+K)">
          <Link2 className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  const isToolbarEnabled = focusedField === 'assetDescription' && !!selectionRange && details.description && details.description.length > 0;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    } else {
      onFileSelect(null);
    }
  };

  const selectedModelData = useMemo(() => {
    return availableModels.find(m => m.internal_identifier === details.model);
  }, [details.model, availableModels]);

  const currentModelVariants = useMemo(() => {
    return selectedModelData?.variants || [];
  }, [selectedModelData]);

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="asset-name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="asset-name"
          value={details.name}
          onChange={(e) => updateDetails('name', e.target.value)}
          placeholder={assetType === 'lora' ? 'My Awesome LoRA' : 'My Cool Workflow'}
          disabled={disabled}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="asset-description">Description</Label>
        {(assetType === 'lora' || assetType === 'workflow') ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mt-1">
            <div className="relative w-full">
              <MarkdownFormattingToolbar isEnabled={isToolbarEnabled} descriptionText={details.description} />
              {focusedField === 'assetDescription' ? (
                <TextareaAutosize
                  ref={descriptionTextareaRef}
                  id="asset-description"
                  placeholder={
                    assetType === 'lora' 
                      ? "Describe the LoRA, how to trigger it (e.g., trigger words, prompt structure), and any tips for best results." 
                      : "Describe what this workflow achieves, any setup required, or how to use it effectively."
                  }
                  value={details.description || ''}
                  onChange={(e) => {
                    updateDetails('description', e.target.value);
                    if (e.target.value === '') {
                      setSelectionRange(null); // Clear selection if text is cleared
                    }
                  }}
                  onFocus={() => {
                    setFocusedField('assetDescription');
                    setTimeout(handleDescriptionSelect, 0); 
                  }}
                  onBlur={handleDescriptionBlur}
                  onSelect={handleDescriptionSelect}
                  disabled={disabled}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none pt-8" // pt-8 for toolbar space
                  minRows={4}
                />
              ) : (
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert break-words p-3 min-h-[120px] border border-input rounded-md cursor-text hover:bg-muted/50 w-full pt-8" // pt-8 for toolbar space
                  onClick={() => {
                     setFocusedField('assetDescription');
                     setTimeout(() => descriptionTextareaRef.current?.focus(), 0);
                  }}
                >
                  {details.description ? (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {details.description}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">
                      {assetType === 'lora' 
                        ? "Describe the LoRA, how to trigger it (e.g., trigger words, prompt structure), and any tips for best results." 
                        : "Describe what this workflow achieves, any setup required, or how to use it effectively."}
                    </p>
                  )}
                </div>
              )}
            </div>
            {assetType === 'lora' && ( // Conditional rendering for the checklist
              <div className="p-3 border rounded-md bg-muted/50 text-sm text-muted-foreground space-y-2 w-full sm:w-auto sm:min-w-[180px] flex-shrink-0">
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
            )}
          </div>
        ) : (
          // Fallback for other asset types, if any, or if rich text is not desired for them
          <Textarea
            id="asset-description"
            value={details.description || ''}
            onChange={(e) => updateDetails('description', e.target.value)}
            placeholder={'Describe your asset...'} // Generic placeholder
            disabled={disabled}
            className="mt-1"
            rows={4}
          />
        )}
      </div>

      <div>
        <Label>Creator</Label>
        <RadioGroup
          value={details.creator}
          onValueChange={(value) => updateDetails('creator', value as 'self' | 'someone_else')}
          className="mt-1 flex gap-4"
          disabled={disabled}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="self" id="creator-self" />
            <Label htmlFor="creator-self" className="font-normal">I made this</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="someone_else" id="creator-someone-else" />
            <Label htmlFor="creator-someone-else" className="font-normal">Someone else made this</Label>
          </div>
        </RadioGroup>
      </div>

      {details.creator === 'someone_else' && (
        <div>
          <Label htmlFor="creator-name">Creator's Name</Label>
          <Input
            id="creator-name"
            value={details.creatorName}
            onChange={(e) => updateDetails('creatorName', e.target.value)}
            placeholder="Enter the original creator's name or username"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      )}

      {/* === Model and Variant Fields (Common for LoRA & Workflow) === */}
      {(assetType === 'lora' || assetType === 'workflow') && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="asset-base-model">Base Model</Label>
              <Select
                value={details.model || ''}
                onValueChange={(value) => {
                  updateDetails('model', value);
                  // Auto-select default/first variant for the new model
                  const modelData = availableModels.find(m => m.internal_identifier === value);
                  if (modelData) {
                    const newVariant = modelData.default_variant || (modelData.variants.length > 0 ? modelData.variants[0] : '');
                    updateDetails('modelVariant', newVariant);
                  }
                }}
                disabled={disabled || isLoadingModels}
              >
                <SelectTrigger id="asset-base-model" className="mt-1">
                  <SelectValue placeholder={isLoadingModels ? "Loading models..." : (availableModels.length === 0 ? "No models available" : "Select Model")} />
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
              <Label htmlFor="asset-model-variant">Model Variant</Label>
              <Select
                value={details.modelVariant || ''}
                onValueChange={(value) => updateDetails('modelVariant', value)}
                disabled={disabled || isLoadingModels || !details.model || currentModelVariants.length === 0}
              >
                <SelectTrigger id="asset-model-variant" className="mt-1">
                  <SelectValue placeholder={!details.model ? "Select model first" : (currentModelVariants.length === 0 ? "No variants" : "Select Variant")} />
                </SelectTrigger>
                <SelectContent>
                  {currentModelVariants.map(variant => (
                    <SelectItem key={variant} value={variant}>{variant}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {/* LoRA Specific Fields */}
      {assetType === 'lora' && (
        <>
          <div>
            <Label htmlFor="lora-type">LoRA Type</Label>
            <Select
              value={details.loraType || 'Concept'}
              onValueChange={(value) => updateDetails('loraType', value)}
              disabled={disabled}
            >
              <SelectTrigger id="lora-type" className="mt-1">
                <SelectValue placeholder="Select LoRA type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Concept">Concept</SelectItem>
                <SelectItem value="Motion Style">Motion Style</SelectItem>
                <SelectItem value="Specific Movement">Specific Movement</SelectItem>
                <SelectItem value="Aesthetic Style">Aesthetic Style</SelectItem>
                <SelectItem value="Control">Control (e.g. Depth, Pose)</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>How would you like to provide the LoRA file?</Label>
            <RadioGroup
              value={details.loraStorageMethod || 'upload'}
              onValueChange={(value) => {
                updateDetails('loraStorageMethod', value as 'upload' | 'link');
                if (value === 'link') {
                  // updateDetails('huggingFaceApiKey', ''); // Clear API key if switching to link
                }
              }}
              className="mt-1 flex gap-4"
              disabled={disabled}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="upload" id="lora-upload" />
                <Label htmlFor="lora-upload" className="font-normal">Upload to Hugging Face</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="link" id="lora-link-method" />
                <Label htmlFor="lora-link-method" className="font-normal">Link to existing file</Label>
              </div>
            </RadioGroup>
          </div>

          {details.loraStorageMethod === 'upload' && (
            <>
              <div>
                <Label htmlFor="huggingface-api-key">Hugging Face API Key (write access)</Label>
                <Input
                  id="huggingface-api-key"
                  type="password"
                  value={details.huggingFaceApiKey || ''}
                  onChange={(e) => {
                    updateDetails('huggingFaceApiKey', e.target.value);
                    // If user types, it means it's not the saved key from DB (or they are overriding it)
                    setHasExistingApiKey(false); 
                  }}
                  placeholder={isCheckingApiKey ? "Checking for saved key..." : (hasExistingApiKey ? "Using saved API key" : "hf_your_api_key")}
                  disabled={disabled || (hasExistingApiKey && details.saveApiKey === false)}
                  className="mt-1"
                />
                 <div className="mt-2 flex items-center space-x-2">
                    <Checkbox
                        id="save-hf-api-key"
                        checked={details.saveApiKey}
                        onCheckedChange={(checked) => updateDetails('saveApiKey', !!checked)}
                        disabled={disabled || !details.huggingFaceApiKey}
                    />
                    <Label htmlFor="save-hf-api-key" className="text-sm font-normal text-muted-foreground">
                        Save API key for future uploads
                    </Label>
                </div>
                {hasExistingApiKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                        A Hugging Face API key is saved for your account. To use it, keep the field above blank or ensure "Save API key" is checked if you enter a new one.
                        To use a different key for this upload only, uncheck "Save API key" and enter the new key.
                    </p>
                )}
              </div>
              <div>
                <Label htmlFor="lora-file-input">LoRA File (.safetensors, .bin, .pt)</Label>
                <Input
                  id="lora-file-input"
                  type="file"
                  onChange={handleFileChange}
                  className="mt-1"
                  accept=".safetensors,.bin,.pt"
                  disabled={disabled}
                />
              </div>
            </>
          )}

          {details.loraStorageMethod === 'link' && (
            <>
              <div>
                <Label htmlFor="lora-link">LoRA Page Link (e.g., CivitAI, Hugging Face)</Label>
                <Input
                  id="lora-link"
                  value={details.loraLink || ''}
                  onChange={(e) => updateDetails('loraLink', e.target.value)}
                  placeholder="https://civitai.com/models/xxxx or https://huggingface.co/user/repo"
                  disabled={disabled}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lora-direct-download-link">Direct Download Link (Optional)</Label>
                <Input
                  id="lora-direct-download-link"
                  value={details.loraDirectDownloadLink || ''}
                  onChange={(e) => updateDetails('loraDirectDownloadLink', e.target.value)}
                  placeholder="https://example.com/path/to/your/lora.safetensors"
                  disabled={disabled}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide a direct link to the LoRA file if the page link above doesn't offer one.
                </p>
              </div>
            </>
          )}
        </>
      )}

      {/* Workflow Specific Fields */}
      {assetType === 'workflow' && (
        <div>
          <Label htmlFor="workflow-file-input">Workflow File (.json, .zip, etc.)</Label>
          <Input
            id="workflow-file-input"
            type="file"
            onChange={handleFileChange} // Same handler, UploadPage distinguishes by uploadMode
            className="mt-1"
            // Add specific accept types for workflows if known, e.g., ".json,.yaml,.zip"
            disabled={disabled}
          />
           <p className="text-xs text-muted-foreground mt-1">
            Upload your workflow file (e.g., ComfyUI JSON, InvokeAI YAML, or a .zip archive).
          </p>
        </div>
      )}
    </div>
  );
};

export default AssetDetailsForm; 