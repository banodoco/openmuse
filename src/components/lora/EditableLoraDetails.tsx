import * as React from "react";
import { useState, useEffect, useImperativeHandle } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TextareaAutosize from 'react-textarea-autosize';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil, Save, X, User as UserIcon } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset, UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth/userProfile';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";
import LoraCreatorInfo from './LoraCreatorInfo';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

// Define ModelData interface (can be moved to a shared types file later)
interface ModelData {
  id: string;
  internal_identifier: string;
  display_name: string;
  variants: string[];
  default_variant?: string | null;
}

interface EditableLoraDetailsProps {
  asset: LoraAsset | null;
  isAuthorized: boolean;
  onDetailsUpdated: () => void;
  hideEditButton?: boolean;
  curatorProfile?: UserProfile | null;
  isLoadingCuratorProfile?: boolean;
}

// Exposed methods for parent components
export interface EditableLoraDetailsHandle {
  startEdit: () => void;
}

const EditableLoraDetails = React.forwardRef<EditableLoraDetailsHandle, EditableLoraDetailsProps>(({
  asset,
  isAuthorized,
  onDetailsUpdated,
  hideEditButton = false,
  curatorProfile,
  isLoadingCuratorProfile
}, ref) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<ModelData[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);

  // Helper function to determine if the current user owns the asset
  const isOwnedByCurrentUser = () => {
    return user && asset?.user_id === user.id;
  };

  const [details, setDetails] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    creator: isOwnedByCurrentUser() ? 'self' : 'someone_else',
    creatorName: asset?.creator?.includes('@') ? asset.creator.substring(1) : asset?.creator || '',
    lora_type: asset?.lora_type || 'Concept',
    lora_base_model: asset?.lora_base_model || '',
    model_variant: asset?.model_variant || '',
    lora_link: asset?.lora_link || '',
    download_link: asset?.download_link || ''
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        const profile = await getCurrentUserProfile();
        setUserProfile(profile);
      }
    };
    loadUserProfile();
  }, [user]);

  // Fetch models from Supabase
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
        toast.error("Failed to load base models.");
      } else if (data) {
        setAvailableModels(data as ModelData[]);
      }
      setIsLoadingModels(false);
    };

    fetchModels();
  }, []);

  // Effect to synchronize asset prop with local details state and fetched models
  useEffect(() => {
    if (asset) {
      let initialModel = asset.lora_base_model || '';
      let initialVariant = asset.model_variant || '';

      if (availableModels.length > 0 && !isLoadingModels) {
        const assetModelInList = availableModels.find(m => m.internal_identifier === initialModel);

        if (initialModel && assetModelInList) {
          // Asset's model is valid and in the fetched list
          if (!assetModelInList.variants.includes(initialVariant)) {
            // Asset's variant is not valid for its model, pick default/first
            initialVariant = assetModelInList.default_variant || (assetModelInList.variants.length > 0 ? assetModelInList.variants[0] : '');
          }
        } else if (availableModels.length > 0) {
          // Asset's model is not set, not in list, or list just loaded; set to first available model
          initialModel = availableModels[0].internal_identifier;
          initialVariant = availableModels[0].default_variant || (availableModels[0].variants.length > 0 ? availableModels[0].variants[0] : '');
        }
      }
      // Only update if truly changed to avoid loops if asset prop itself is stable
      setDetails(prev => ({
        ...prev,
        name: asset.name || '',
        description: asset.description || '',
        creator: isOwnedByCurrentUser() ? 'self' : (asset.creator ? 'someone_else' : 'self'), // Adjusted logic slightly
        creatorName: asset.creator?.includes('@') ? asset.creator.substring(1) : (asset.creator && !isOwnedByCurrentUser() ? asset.creator : ''),
        lora_type: asset.lora_type || 'Concept',
        lora_base_model: initialModel,
        model_variant: initialVariant,
        lora_link: asset.lora_link || '',
        download_link: asset.download_link || ''
      }));
    }
  }, [asset, availableModels, isLoadingModels, user]);

  // Effect to synchronize model variant when model changes in edit mode
  useEffect(() => {
    if (!isLoadingModels && availableModels.length > 0 && details.lora_base_model) {
      const selectedModelData = availableModels.find(m => m.internal_identifier === details.lora_base_model);
      if (selectedModelData) {
        // Check if the current variant is valid for the selected model
        if (!selectedModelData.variants.includes(details.model_variant)) {
          const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
          updateField('model_variant', newVariant);
        }
      }
    }
  }, [details.lora_base_model, availableModels, isLoadingModels]);

  const handleEdit = () => {
    setDetails({
      name: asset?.name || '',
      description: asset?.description || '',
      creator: isOwnedByCurrentUser() ? 'self' : 'someone_else',
      creatorName: asset?.creator?.includes('@') ? asset.creator.substring(1) : asset?.creator || '',
      lora_type: asset?.lora_type || 'Concept',
      lora_base_model: asset?.lora_base_model || '',
      model_variant: asset?.model_variant || '',
      lora_link: asset?.lora_link || '',
      download_link: asset?.download_link || ''
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!asset || !user || !userProfile) return;
    
    setIsSaving(true);
    try {
      const updates: any = {
        name: details.name,
        description: details.description,
        lora_type: details.lora_type,
        lora_base_model: details.lora_base_model,
        model_variant: details.model_variant,
        lora_link: details.lora_link,
        download_link: details.download_link
      };

      if (details.creator === 'self') {
        updates.creator = userProfile.display_name || userProfile.username;
        updates.user_id = user.id;
      } else {
        updates.creator = `@${details.creatorName}`;
        // When changing from self to someone else, clear the user_id
        if (isOwnedByCurrentUser()) {
          updates.user_id = null;
        }
      }

      const { error } = await supabase
        .from('assets')
        .update(updates)
        .eq('id', asset.id);
      
      if (error) throw error;
      
      onDetailsUpdated();
      setIsEditing(false);
      toast.success('LoRA details updated successfully');
    } catch (error) {
      console.error('Error updating LoRA details:', error);
      toast.error('Failed to update LoRA details');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Expose the edit method to parent via ref
  useImperativeHandle(ref, () => ({
    startEdit: handleEdit
  }));

  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="lora-name" className="text-sm font-medium mb-1.5 block">
              LoRA Name <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              id="lora-name"
              placeholder="Enter LoRA name"
              value={details.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              disabled={isSaving}
            />
          </div>
          
          <div>
            <Label htmlFor="lora-description" className="text-sm font-medium mb-1.5 block">
              LoRA Description
            </Label>
            <TextareaAutosize
              id="lora-description"
              placeholder="Enter LoRA description"
              value={details.description}
              onChange={(e) => updateField('description', e.target.value)}
              disabled={isSaving}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              minRows={3}
            />
          </div>

          <div>
            <Label className="text-sm font-medium block mb-2">
              Who made this LoRA?
            </Label>
            <RadioGroup 
              value={details.creator}
              onValueChange={(value: 'self' | 'someone_else') => updateField('creator', value)}
              className="flex flex-col space-y-2"
              disabled={isSaving}
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

          {details.creator === 'someone_else' && (
            <div>
              <Label htmlFor="creator-name" className="text-sm font-medium mb-1.5 block">
                Creator Username <span className="text-destructive">*</span>
              </Label>
              <Input
                type="text"
                id="creator-name"
                placeholder="Username of the creator"
                value={details.creatorName}
                onChange={(e) => updateField('creatorName', e.target.value)}
                required
                disabled={isSaving}
              />
            </div>
          )}

          <div>
            <Label htmlFor="lora-model" className="text-sm font-medium mb-1.5 block">
              Which model was this trained on? <span className="text-destructive">*</span>
            </Label>
            <Select 
              value={details.lora_base_model} 
              onValueChange={(value) => {
                updateField('lora_base_model', value);
                // When model changes, find its variants and set the default/first
                const selectedModelData = availableModels.find(m => m.internal_identifier === value);
                if (selectedModelData) {
                  // Always update the variant when model changes to ensure it's valid
                  const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
                  updateField('model_variant', newVariant);
                } else {
                  updateField('model_variant', ''); // Clear variant if model becomes invalid
                }
              }}
              disabled={isSaving || isLoadingModels}
            >
              <SelectTrigger className="w-full">
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
            <Label htmlFor="model-variant" className="text-sm font-medium mb-1.5 block">
              Model Variant <span className="text-destructive">*</span>
            </Label>
            {(() => {
              const selectedModelData = availableModels.find(m => m.internal_identifier === details.lora_base_model);
              const variants = selectedModelData ? selectedModelData.variants : [];
              
              if (isLoadingModels || !selectedModelData) {
                return (
                  <Input
                    type="text"
                    id="model-variant-display"
                    value={details.model_variant || (isLoadingModels ? "Loading..." : "Select model first")}
                    readOnly
                    disabled // Visually indicate it's not interactive
                    className="bg-muted"
                  />
                );
              }

              return (
                <Select 
                  value={details.model_variant} 
                  onValueChange={(value) => updateField('model_variant', value)}
                  disabled={isSaving || variants.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={variants.length === 0 ? "No variants available" : "Select Variant"} />
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
              value={details.lora_type} 
              onValueChange={(value) => updateField('lora_type', value)}
              disabled={isSaving}
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
            <Label htmlFor="lora-link" className="text-sm font-medium mb-1.5 block">
              LoRA Link (Huggingface, Civit, etc.)
            </Label>
            <Input
              type="url"
              id="lora-link"
              placeholder="Enter LoRA link"
              value={details.lora_link}
              onChange={(e) => updateField('lora_link', e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div>
            <Label htmlFor="lora-download-link" className="text-sm font-medium mb-1.5 block">
              Direct Download URL
            </Label>
            <Input
              type="url"
              id="lora-download-link"
              placeholder="Enter direct download URL"
              value={details.download_link}
              onChange={(e) => updateField('download_link', e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={handleSave} 
            className="gap-1"
            disabled={isSaving || !details.name}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button 
            onClick={handleCancel} 
            variant="outline" 
            className="gap-1"
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Display Mode (Reverted Structure) --- 
  return (
    <div>
      {/* Edit button - Placed back inside the main div if needed, or keep outside if AssetInfoCard handles it */}
      {/* Example: 
      {isAuthorized && !hideEditButton && (
        <div className="flex justify-end mb-2"> 
          <Button variant="ghost" size="sm" onClick={handleEdit} className="h-7 px-2 py-1.5">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )} 
      */} 

      {/* Main Content Area */} 
      <div className="space-y-3 text-sm"> 
        {/* Wrapper for Creator and Curator */}
        <div className="flex items-start space-x-4"> 
          {/* Creator Info */} 
          <div>
            <Label className="text-xs text-muted-foreground">Creator</Label>
            <LoraCreatorInfo 
              asset={asset} 
              avatarSize="h-6 w-6" 
              textSize="text-sm" 
              className="pt-1"
            />
          </div>

          {/* Curator Info - Conditionally Rendered */} 
          {isLoadingCuratorProfile ? (
            <div>
              <Label className="text-xs text-muted-foreground">Curated by</Label>
              <div className="flex items-center space-x-2 pt-1">
                <Skeleton className="h-6 w-6 rounded-full" /> 
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ) : curatorProfile ? (
            <div>
              <Label className="text-xs text-muted-foreground">Curated by</Label>
              <Link 
                to={`/profile/${encodeURIComponent(curatorProfile.username)}`} 
                className="flex items-center space-x-2 group w-fit pt-1" 
                onClick={(e) => e.stopPropagation()}
              >
                <Avatar className="h-6 w-6 group-hover:ring-2 group-hover:ring-primary transition-all">
                  <AvatarImage src={curatorProfile.avatar_url ?? undefined} alt={curatorProfile.display_name || curatorProfile.username} />
                  <AvatarFallback>
                    {(curatorProfile.display_name || curatorProfile.username)?.[0]?.toUpperCase() || <UserIcon className="h-3 w-3" />}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium group-hover:text-primary transition-colors text-sm">
                  {curatorProfile.display_name || curatorProfile.username}
                </span>
              </Link>
            </div>
          ) : null}
        </div>

        {/* Description */} 
        {asset?.description && (
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <div className="prose prose-sm max-w-none dark:prose-invert break-words">
              <ReactMarkdown
                components={{
                  a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                  ),
                }}
              >
                {asset.description}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Model Details - Reverted Structure */} 
        {(asset?.lora_base_model || asset?.lora_type || asset?.lora_link || asset?.download_link) && <hr className="my-2" />} 
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {asset?.lora_base_model && (
             <div className="space-y-0.5">
               <Label className="text-xs text-muted-foreground">Base Model</Label>
               <p className="text-sm font-medium">
                 {asset.lora_base_model}
                 {asset.model_variant ? ` (${asset.model_variant})` : ''}
               </p>
             </div>
          )}
          {asset?.lora_type && (
             <div className="space-y-0.5">
               <Label className="text-xs text-muted-foreground">Type</Label>
               <p className="text-sm font-medium">{asset.lora_type}</p>
             </div>
          )}
          {/* Removed plain text Source Link and Direct Download renderings */}
        </div>

      </div>
    </div>
  );
});

export default EditableLoraDetails;
