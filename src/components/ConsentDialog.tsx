
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

const ConsentDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  useEffect(() => {
    const hasUserAcknowledged = localStorage.getItem('video_upload_consent') === 'true';
    if (!hasUserAcknowledged) {
      setOpen(true);
    }
  }, []);

  const handleAcknowledgment = (checked: boolean) => {
    setHasAcknowledged(checked);
  };

  const handleConfirm = () => {
    if (hasAcknowledged) {
      localStorage.setItem('video_upload_consent', 'true');
      setOpen(false);
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
            disabled={!hasAcknowledged}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConsentDialog;
