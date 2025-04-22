import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const loraFormSchema = z.object({
  name: z.string().min(3, { message: 'Name must be at least 3 characters' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
  loraType: z.enum(['character', 'style', 'concept', 'other']),
  baseModel: z.enum(['SD 1.5', 'SDXL', 'Other']),
  modelVariant: z.string().optional(),
  loraLink: z.string().url({ message: 'Please enter a valid URL' }),
});

type LoraFormValues = z.infer<typeof loraFormSchema>;

interface LoRADetailsFormProps {
  onCancel?: () => void;
  onSuccess?: (loraId: string) => void;
}

const LoRADetailsForm: React.FC<LoRADetailsFormProps> = ({ onCancel, onSuccess }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoraFormValues>({
    resolver: zodResolver(loraFormSchema),
    defaultValues: {
      name: '',
      description: '',
      loraType: 'character',
      baseModel: 'SD 1.5',
      modelVariant: '',
      loraLink: '',
    },
  });

  const onSubmit = async (values: LoraFormValues) => {
    if (!user) {
      setError('You must be logged in to create a LoRA');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Insert the LoRA asset into the database
      const { data, error: insertError } = await supabase
        .from('assets')
        .insert([
          {
            name: values.name,
            description: values.description,
            type: 'lora',
            user_id: user.id,
            creator: user.email,
            lora_type: values.loraType,
            lora_base_model: values.baseModel,
            model_variant: values.modelVariant || null,
            lora_link: values.loraLink,
          },
        ])
        .select();

      if (insertError) {
        throw insertError;
      }

      if (data && data.length > 0) {
        const newLoraId = data[0].id;
        toast.success('LoRA created successfully!');
        
        // If onSuccess is provided, call it instead of navigating
        if (onSuccess) {
          onSuccess(newLoraId);
        } else if (onCancel) { // Fallback to onCancel if no onSuccess
          onCancel();
        } else {
          // Only navigate if neither onSuccess nor onCancel is provided
          navigate(`/assets/loras/${newLoraId}`);
        }
      }
    } catch (err) {
      console.error('Error creating LoRA:', err);
      setError('Failed to create LoRA. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LoRA Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter LoRA name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe what this LoRA does and how to use it" 
                    className="min-h-[100px]" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="loraType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>LoRA Type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="character">Character</SelectItem>
                      <SelectItem value="style">Style</SelectItem>
                      <SelectItem value="concept">Concept</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base Model</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select base model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SD 1.5">SD 1.5</SelectItem>
                      <SelectItem value="SDXL">SDXL</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="modelVariant"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Model Variant (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Realistic, Anime, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="loraLink"
            render={({ field }) => (
              <FormItem>
                <FormLabel>LoRA Link</FormLabel>
                <FormControl>
                  <Input placeholder="URL to the LoRA (e.g., Civitai, Hugging Face)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-2 pt-4">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : 'Create LoRA'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default LoRADetailsForm;
