import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogFooter, // Import if needed for separate actions
  DialogClose   // Import if needed for explicit close button
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import UploadContent from '@/components/upload/UploadContent';

interface UploadModalProps {
  trigger: React.ReactNode; // The element that opens the modal
  initialUploadType?: 'lora' | 'video';
  onUploadSuccess?: () => void; // Optional callback on success
}

const UploadModal: React.FC<UploadModalProps> = ({ 
  trigger, 
  initialUploadType = 'lora',
  onUploadSuccess
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = () => {
    setIsOpen(false); // Close modal on success
    onUploadSuccess?.(); // Call parent callback if provided
  };

  const handleCancel = () => {
    setIsOpen(false); // Close modal on cancel
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw]">
        <DialogHeader>
          {/* Optional: Add DialogDescription here */}
        </DialogHeader>
        <div className="py-4 max-h-[80vh] overflow-y-auto">
          <UploadContent 
            initialUploadType={initialUploadType}
            onSuccess={handleSuccess}
            onCancel={handleCancel} // Pass cancel handler to UploadContent
          />
        </div>
        {/* 
          DialogFooter can be used if you want actions outside UploadContent, 
          but UploadContent now handles its own submit/cancel buttons.
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
          </DialogFooter> 
        */}
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal; 