
import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const ConsentDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkUserConsent = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          return;
        }
        
        const { data, error } = await supabase
          .from('profiles')
          .select('video_upload_consent')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error('Error checking consent:', error);
          // If there's an error, show the dialog to be safe
          setOpen(true);
          return;
        }
        
        // Only show dialog if user hasn't given consent yet
        if (!data.video_upload_consent) {
          setOpen(true);
        }
      } catch (error) {
        console.error('Error checking consent status:', error);
        setOpen(true);
      }
    };
    
    checkUserConsent();
  }, []);

  const handleAcknowledgment = (checked: boolean) => {
    setHasAcknowledged(checked);
  };

  const handleConfirm = async () => {
    if (!hasAcknowledged) return;
    
    try {
      setLoading(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('You must be logged in to continue');
        return;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ video_upload_consent: true })
        .eq('id', session.user.id);
      
      if (error) {
        console.error('Error saving consent:', error);
        toast.error('Failed to save your consent. Please try again.');
        return;
      }
      
      setOpen(false);
      toast.success('Consent saved successfully');
    } catch (error) {
      console.error('Error saving consent:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Important Information</DialogTitle>
        </DialogHeader>
        <Alert className="my-4 bg-amber-50 border-amber-200">
          <AlertDescription className="space-y-4">
            <p className="text-amber-800">
              All videos you upload will be shared publicly as part of a dataset.
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="consent"
                checked={hasAcknowledged}
                onCheckedChange={handleAcknowledgment}
              />
              <label
                htmlFor="consent"
                className="text-sm font-medium cursor-pointer"
              >
                I know
              </label>
            </div>
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button
            onClick={handleConfirm}
            disabled={!hasAcknowledged || loading}
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
            ) : null}
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentDialog;
