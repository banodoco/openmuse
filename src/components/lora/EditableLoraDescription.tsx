
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X } from "lucide-react";
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LoraAsset } from '@/lib/types';

interface EditableLoraDescriptionProps {
  asset: LoraAsset | null;
  isAuthorized: boolean;
  onDescriptionUpdated: (newDescription: string) => void;
}

const EditableLoraDescription: React.FC<EditableLoraDescriptionProps> = ({
  asset,
  isAuthorized,
  onDescriptionUpdated
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(asset?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setDescription(asset?.description || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setDescription(asset?.description || '');
  };

  const handleSave = async () => {
    if (!asset) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ description })
        .eq('id', asset.id);
      
      if (error) throw error;
      
      onDescriptionUpdated(description);
      setIsEditing(false);
      toast.success('Description updated successfully');
    } catch (error) {
      console.error('Error updating description:', error);
      toast.error('Failed to update description');
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-3">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter LoRA description"
          className="min-h-[120px]"
          disabled={isSaving}
        />
        <div className="flex space-x-2">
          <Button 
            onClick={handleSave} 
            size="sm" 
            className="gap-1"
            disabled={isSaving}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button 
            onClick={handleCancel} 
            variant="outline" 
            size="sm"
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

  return (
    <div className="relative">
      <div className="prose prose-sm max-w-none">
        {asset?.description ? (
          <p className="whitespace-pre-wrap">{asset.description}</p>
        ) : (
          <p className="text-muted-foreground italic">No description provided</p>
        )}
      </div>
      
      {isAuthorized && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 h-7 w-7 p-0"
          onClick={handleEdit}
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit description</span>
        </Button>
      )}
    </div>
  );
};

export default EditableLoraDescription;
