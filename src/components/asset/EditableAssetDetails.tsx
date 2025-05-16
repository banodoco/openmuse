import * as React from "react";
import { useState, useEffect, useImperativeHandle, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import TextareaAutosize from 'react-textarea-autosize';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Pencil, Save, X, User as UserIcon, Bold, Italic, Link2, Download, ExternalLink } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AnyAsset, UserProfile, AssetType, LoraAsset, WorkflowAsset } from '@/lib/types'; // Updated types
import { useAuth } from '@/hooks/useAuth';
import { getCurrentUserProfile } from '@/lib/auth/userProfile';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from 'react-router-dom';
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import AssetCreatorInfo from '@/components/asset/AssetCreatorInfo'; // Assuming this is the correct path

interface ModelData {
  id: string;
  internal_identifier: string;
  display_name: string;
  variants: string[];
  default_variant?: string | null;
}

interface EditableAssetDetailsProps { // Renamed interface
  asset: AnyAsset | null; // Changed to AnyAsset
  isAuthorized: boolean;
  onDetailsUpdated: () => void;
  hideEditButton?: boolean;
  curatorProfile?: UserProfile | null;
  isLoadingCuratorProfile?: boolean;
}

export interface EditableAssetDetailsHandle { // Renamed handle
  startEdit: () => void;
}

const EditableAssetDetails = React.forwardRef<EditableAssetDetailsHandle, EditableAssetDetailsProps>((
  { asset, isAuthorized, onDetailsUpdated, hideEditButton = false, curatorProfile, isLoadingCuratorProfile }, ref
) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<ModelData[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);

  const isOwnedByCurrentUser = () => user && asset?.user_id === user.id;

  const [details, setDetails] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    creator: isOwnedByCurrentUser() ? 'self' : 'someone_else',
    creatorName: asset?.creator?.includes('@') ? asset.creator.substring(1) : asset?.creator || '',
    // LoRA specific - will be conditional
    lora_type: asset?.type === 'lora' ? (asset as LoraAsset).lora_type || 'Concept' : undefined,
    lora_base_model: asset?.type === 'lora' ? (asset as LoraAsset).lora_base_model || '' : undefined,
    model_variant: asset?.type === 'lora' ? (asset as LoraAsset).model_variant || '' : undefined,
    lora_link: asset?.type === 'lora' ? (asset as LoraAsset).lora_link || '' : undefined,
    // Common download_link (can be LoRA direct or Workflow file)
    download_link: asset?.download_link || '' 
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) setUserProfile(await getCurrentUserProfile());
    };
    loadUserProfile();
  }, [user]);

  useEffect(() => {
    if (asset?.type !== 'lora') {
      setIsLoadingModels(false);
      setAvailableModels([]);
      return;
    }
    const fetchModels = async () => {
      setIsLoadingModels(true);
      const { data, error } = await supabase.from('models').select('id, internal_identifier, display_name, variants, default_variant').eq('is_active', true).order('sort_order', { ascending: true }).order('display_name', { ascending: true });
      if (error) toast.error("Failed to load base models.");
      else if (data) setAvailableModels(data as ModelData[]);
      setIsLoadingModels(false);
    };
    fetchModels();
  }, [asset?.type]); // Fetch models only if asset type is lora

  useEffect(() => {
    if (asset) {
      let initialModel = asset.type === 'lora' ? (asset as LoraAsset).lora_base_model || '' : undefined;
      let initialVariant = asset.type === 'lora' ? (asset as LoraAsset).model_variant || '' : undefined;

      if (asset.type === 'lora' && availableModels.length > 0 && !isLoadingModels) {
        const loraAsset = asset as LoraAsset;
        const assetModelInList = availableModels.find(m => m.internal_identifier === initialModel);
        if (initialModel && assetModelInList) {
          if (!assetModelInList.variants.includes(initialVariant || '')) {
            initialVariant = assetModelInList.default_variant || (assetModelInList.variants.length > 0 ? assetModelInList.variants[0] : '');
          }
        } else if (availableModels.length > 0) {
          initialModel = availableModels[0].internal_identifier;
          initialVariant = availableModels[0].default_variant || (availableModels[0].variants.length > 0 ? availableModels[0].variants[0] : '');
        }
      }
      setDetails(prev => ({
        ...prev,
        name: asset.name || '',
        description: asset.description || '',
        creator: isOwnedByCurrentUser() ? 'self' : (asset.creator ? 'someone_else' : 'self'),
        creatorName: asset.creator?.includes('@') ? asset.creator.substring(1) : (asset.creator && !isOwnedByCurrentUser() ? asset.creator : ''),
        lora_type: asset.type === 'lora' ? (asset as LoraAsset).lora_type || 'Concept' : undefined,
        lora_base_model: initialModel,
        model_variant: initialVariant,
        lora_link: asset.type === 'lora' ? (asset as LoraAsset).lora_link || '' : undefined,
        download_link: asset.download_link || ''
      }));
    }
  }, [asset, availableModels, isLoadingModels, user]);

  useEffect(() => {
    if (asset?.type === 'lora' && !isLoadingModels && availableModels.length > 0 && details.lora_base_model) {
      const selectedModelData = availableModels.find(m => m.internal_identifier === details.lora_base_model);
      if (selectedModelData) {
        if (!selectedModelData.variants.includes(details.model_variant || '')) {
          const newVariant = selectedModelData.default_variant || (selectedModelData.variants.length > 0 ? selectedModelData.variants[0] : '');
          updateField('model_variant', newVariant);
        }
      }
    }
  }, [asset?.type, details.lora_base_model, details.model_variant, availableModels, isLoadingModels]); // Added details.model_variant

  const handleEdit = () => {
    if (!asset) return;
    setDetails({
      name: asset.name || '',
      description: asset.description || '',
      creator: isOwnedByCurrentUser() ? 'self' : 'someone_else',
      creatorName: asset.creator?.includes('@') ? asset.creator.substring(1) : asset.creator || '',
      lora_type: asset.type === 'lora' ? (asset as LoraAsset).lora_type || 'Concept' : undefined,
      lora_base_model: asset.type === 'lora' ? (asset as LoraAsset).lora_base_model || '' : undefined,
      model_variant: asset.type === 'lora' ? (asset as LoraAsset).model_variant || '' : undefined,
      lora_link: asset.type === 'lora' ? (asset as LoraAsset).lora_link || '' : undefined,
      download_link: asset.download_link || ''
    });
    setIsEditing(true);
  };

  const handleCancel = () => { setIsEditing(false); setFocusedField(null); setSelectionRange(null); };

  const handleSave = async () => {
    if (!asset || !user || !userProfile) return;
    setIsSaving(true);
    try {
      // Initialize with common fields, explicitly type as Partial<AnyAsset>
      const commonUpdates: Partial<AnyAsset> = {
        name: details.name,
        description: details.description,
        download_link: details.download_link,
      };

      if (details.creator === 'self') {
        commonUpdates.creator = userProfile.display_name || userProfile.username;
        commonUpdates.user_id = user.id;
      } else {
        commonUpdates.creator = `@${details.creatorName}`;
        if (isOwnedByCurrentUser()) commonUpdates.user_id = null;
      }

      let finalUpdates: Partial<AnyAsset> = commonUpdates;

      if (asset.type === 'lora') {
        // For LoRA, merge with LoRA-specific fields
        const loraUpdates: Partial<LoraAsset> = {
          ...commonUpdates, // Spread common updates first
          type: 'lora', // Ensure type is correctly maintained
          lora_type: details.lora_type,
          lora_base_model: details.lora_base_model,
          model_variant: details.model_variant,
          lora_link: details.lora_link,
        };
        finalUpdates = loraUpdates;
      } else if (asset.type === 'workflow') {
        // For Workflow, commonUpdates are enough, but ensure type is set
        finalUpdates = {
            ...commonUpdates,
            type: 'workflow'
        };
      }
      // No workflow-specific editable fields in this form other than common ones yet

      const { error } = await supabase.from('assets').update(finalUpdates).eq('id', asset.id);
      if (error) throw error;
      onDetailsUpdated();
      setIsEditing(false);
      toast.success(`${asset.type.charAt(0).toUpperCase() + asset.type.slice(1)} details updated`);
    } catch (error) { 
      console.error('Error updating asset details:', error);
      toast.error(`Failed to update details`);
    } finally { setIsSaving(false); setFocusedField(null); setSelectionRange(null); }
  };

  const updateField = (field: keyof typeof details, value: string | undefined) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };
  
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
      if (activeEl !== descriptionTextareaRef.current && !activeEl?.closest('.editable-asset-markdown-toolbar')) {
        if (focusedField === 'description') {
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
    
    updateField('description', newValue);

    setTimeout(() => {
      if (descriptionTextareaRef.current) {
        descriptionTextareaRef.current.focus();
        const newCursorPos = start + replacement.length;
        descriptionTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        handleDescriptionSelect(); 
      }
    }, 0);
    setFocusedField('description'); 
  };

  interface MarkdownFormattingToolbarProps { isEnabled: boolean; descriptionText: string;}
  const MarkdownFormattingToolbar: React.FC<MarkdownFormattingToolbarProps> = ({ isEnabled, descriptionText }) => {
    const effectiveIsEnabled = isEnabled && descriptionText && descriptionText.length > 0;
    const title = effectiveIsEnabled ? "" : "Highlight text in description to enable formatting.";

    return (
      <div
        className="editable-asset-markdown-toolbar absolute top-1 right-1 z-10 bg-background border rounded-md shadow-lg p-1 flex space-x-1"
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

  useImperativeHandle(ref, () => ({ startEdit: handleEdit }));

  if (isEditing) {
    const isToolbarEnabled = focusedField === 'description' && !!selectionRange && !!details.description && details.description.length > 0;
    return (
      <div className="space-y-6 relative">
        <div className="space-y-4">
          <div>
            <Label htmlFor="asset-name" className="text-sm font-medium mb-1.5 block">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              type="text"
              id="asset-name"
              placeholder={asset?.type === 'lora' ? 'Enter LoRA name' : (asset?.type === 'workflow' ? 'Enter Workflow name' : 'Enter asset name')}
              value={details.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
              disabled={isSaving}
              className="w-full"
            />
          </div>
          
          <div>
            <Label htmlFor="asset-description" className="text-sm font-medium mb-1.5 block">
              Description
            </Label>
            <div className="relative">
              {focusedField === 'description' ? (
                <>
                  <MarkdownFormattingToolbar isEnabled={isToolbarEnabled} descriptionText={details.description || ''} />
                  <TextareaAutosize 
                    ref={descriptionTextareaRef} 
                    id="asset-description" 
                    placeholder={asset?.type === 'lora' ? 'Describe your LoRA...' : (asset?.type === 'workflow' ? 'Describe your workflow...' : 'Describe the asset...')}
                    value={details.description || ''} 
                    onChange={(e) => {
                        updateField('description', e.target.value);
                        if (e.target.value === '') setSelectionRange(null);
                    }}
                    onFocus={() => setFocusedField('description')} 
                    onBlur={handleDescriptionBlur} 
                    onSelect={handleDescriptionSelect} 
                    disabled={isSaving} 
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none pt-8"
                    minRows={3}
                  />
                </>
              ) : (
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert break-words p-3 min-h-[80px] border border-input rounded-md cursor-text hover:bg-muted/50 w-full pt-8" // pt-8 for potential toolbar space, though toolbar is hidden
                  onClick={() => {
                     setFocusedField('description');
                     // Ensure textarea gets focus to trigger onFocus logic for selection
                     setTimeout(() => descriptionTextareaRef.current?.focus(), 0);
                  }}
                >
                  {details.description ? (
                    <ReactMarkdown
                      components={{
                        // Ensure links open in new tabs
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {details.description}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground italic">
                      {asset?.type === 'lora' ? 'Describe your LoRA...' : (asset?.type === 'workflow' ? 'Describe your workflow...' : 'Describe the asset...')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          <div><Label>Creator</Label> <RadioGroup value={details.creator} onValueChange={(v) => updateField('creator', v as any)} className="flex flex-col space-y-2" disabled={isSaving}><div className="flex items-center space-x-2"><RadioGroupItem value="self" id="creator-self"/><Label htmlFor="creator-self">I made it</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="someone_else" id="creator-someone"/><Label htmlFor="creator-someone">Someone else</Label></div></RadioGroup></div>
          {details.creator === 'someone_else' && <div><Label htmlFor="creator-name">Creator Username <span className="text-destructive">*</span></Label><Input id="creator-name" value={details.creatorName} onChange={(e) => updateField('creatorName', e.target.value)} required disabled={isSaving} /></div>}

          {asset?.type === 'lora' && (
            <>
              <div><Label htmlFor="lora-model">Base Model <span className="text-destructive">*</span></Label>
                <Select value={details.lora_base_model} onValueChange={(v) => { updateField('lora_base_model', v); const smd = availableModels.find(m=>m.internal_identifier===v); if(smd){updateField('model_variant', smd.default_variant || (smd.variants.length>0 ? smd.variants[0] : ''));}else{updateField('model_variant','');} }} disabled={isSaving || isLoadingModels}>
                  <SelectTrigger><SelectValue placeholder={isLoadingModels?"Loading...":"Select Model"}/></SelectTrigger>
                  <SelectContent>{availableModels.map(m => <SelectItem key={m.id} value={m.internal_identifier}>{m.display_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="model-variant">Model Variant <span className="text-destructive">*</span></Label>
                {(() => {
                  const selectedModel = availableModels.find(m => m.internal_identifier === details.lora_base_model);
                  const variants = selectedModel ? selectedModel.variants : [];
                  if(isLoadingModels || !selectedModel) return <Input id="model-variant-display" value={details.model_variant || (isLoadingModels?"Loading...":"Select model first")} readOnly disabled className="bg-muted"/>;
                  return <Select value={details.model_variant} onValueChange={(v)=>updateField('model_variant',v)} disabled={isSaving||variants.length===0}><SelectTrigger><SelectValue placeholder={variants.length===0?"No variants":"Select Variant"}/></SelectTrigger><SelectContent>{variants.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>;
                })()}
              </div>
              <div><Label htmlFor="lora-type">LoRA Type <span className="text-destructive">*</span></Label>
                <Select value={details.lora_type} onValueChange={(v)=>updateField('lora_type',v)} disabled={isSaving}><SelectTrigger><SelectValue placeholder="Select Type"/></SelectTrigger><SelectContent><SelectItem value="Concept">Concept</SelectItem><SelectItem value="Motion Style">Motion Style</SelectItem><SelectItem value="Specific Movement">Specific Movement</SelectItem><SelectItem value="Aesthetic Style">Aesthetic Style</SelectItem><SelectItem value="Control">Control</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select>
              </div>
              <div><Label htmlFor="lora-link">LoRA Link</Label><Input id="lora-link" value={details.lora_link || ''} onChange={(e)=>updateField('lora_link',e.target.value)} disabled={isSaving}/></div>
            </>
          )}
          {/* Common Download link - for LoRA it's direct, for Workflow it's the main file */}
          <div><Label htmlFor="asset-download-link">Direct Download URL {(asset?.type === 'workflow') && <span className="text-destructive">*</span>}</Label><Input id="asset-download-link" value={details.download_link || ''} onChange={(e)=>updateField('download_link',e.target.value)} disabled={isSaving || (asset?.type === 'workflow')} placeholder={asset?.type === 'workflow' ? 'Workflow file URL (auto-filled on upload)' : 'Optional direct LoRA file URL'} readOnly={asset?.type === 'workflow'} /></div>
        </div>
        <div className="flex space-x-2"><Button onClick={handleSave} disabled={isSaving || !details.name}><Save className="h-4 w-4 mr-1"/>Save</Button><Button onClick={handleCancel} variant="outline" disabled={isSaving}><X className="h-4 w-4 mr-1"/>Cancel</Button></div>
      </div>
    );
  }
  
  // --- Display Mode --- 
  if (isEditing) {
    // ... (edit mode JSX as before) ...
    return <></>; // Placeholder for brevity, actual edit mode JSX is complex
  }

  // Early return if asset is null (already handled in AssetCard, but good practice here too)
  if (!asset) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">Asset details not available.</p>
      </div>
    );
  }

  const loraAsset = asset.type === 'lora' ? asset as LoraAsset : null;
  const workflowAsset = asset.type === 'workflow' ? asset as WorkflowAsset : null; // Now correctly typed with optional model fields

  return (
    <div>
      <div className="space-y-3 text-sm">
        <div className="flex items-start space-x-4 mb-3"> 
          <div>
            <Label className="text-xs text-muted-foreground">Creator</Label>
            <AssetCreatorInfo 
              asset={asset} 
              avatarSize="h-6 w-6" 
              textSize="text-sm" 
              className="pt-1" 
              isCreatorNameLink={!asset.user_id && !!asset.creator} // Link if creator is text & no user_id
            />
          </div>
          {isLoadingCuratorProfile ? ( <div><Label className="text-xs text-muted-foreground">Curated by</Label><div className="flex items-center space-x-2 pt-1"><Skeleton className="h-6 w-6 rounded-full"/><Skeleton className="h-4 w-20"/></div></div>
          ) : curatorProfile ? ( <div><Label className="text-xs text-muted-foreground">Curated by</Label><Link to={`/profile/${encodeURIComponent(curatorProfile.username)}`} className="flex items-center space-x-2 group w-fit pt-1" onClick={(e)=>e.stopPropagation()}><Avatar className="h-6 w-6"><AvatarImage src={curatorProfile.avatar_url ?? undefined}/><AvatarFallback>{(curatorProfile.display_name||curatorProfile.username)?.[0]?.toUpperCase()||<UserIcon className="h-3 w-3"/>}</AvatarFallback></Avatar><span className="font-medium group-hover:text-primary transition-colors text-sm">{curatorProfile.display_name||curatorProfile.username}</span></Link></div>
          ) : null}
        </div>

        {asset.description && ( <div className="space-y-1 pt-1"><Label className="text-xs text-muted-foreground">Description</Label><div className="prose prose-sm max-w-none dark:prose-invert break-words"><ReactMarkdown components={{a:({node,...props})=><a {...props} target="_blank" rel="noopener noreferrer"/>}}>{asset.description}</ReactMarkdown></div></div> )}
        
        {(loraAsset || (workflowAsset && (workflowAsset.lora_base_model || workflowAsset.download_link))) && <hr className="my-3 border-border/50" />}

        {loraAsset && (
          <div className="space-y-2">
            {(loraAsset.lora_base_model || loraAsset.lora_type) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {loraAsset.lora_base_model && (
                        <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Base Model</Label>
                            <p className="text-sm font-medium">
                                {loraAsset.lora_base_model}
                                {loraAsset.model_variant ? ` (${loraAsset.model_variant})` : ''}
                            </p>
                        </div>
                    )}
                    {loraAsset.lora_type && (
                        <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <p className="text-sm font-medium">{loraAsset.lora_type}</p>
                        </div>
                    )}
                </div>
            )}
          </div>
        )}
        
        {workflowAsset && (workflowAsset.lora_base_model || workflowAsset.model_variant) && (
            <div className="space-y-2 mt-2">
                 <Label className="text-xs text-muted-foreground font-semibold mb-1 block">Workflow Model Info</Label>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {workflowAsset.lora_base_model && (
                        <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Base Model</Label>
                            <p className="text-sm font-medium">
                                {workflowAsset.lora_base_model}
                                {workflowAsset.model_variant ? ` (${workflowAsset.model_variant})` : ''}
                            </p>
                        </div>
                    )}
                    {workflowAsset.model_variant && !workflowAsset.lora_base_model && (
                         <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Model Variant</Label>
                            <p className="text-sm font-medium">
                                {workflowAsset.model_variant}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )}

      </div>
    </div>
  );
});

export default EditableAssetDetails; 