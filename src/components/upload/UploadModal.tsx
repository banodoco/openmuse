import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
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
          <DialogTitle className="text-lg font-semibold">
            {initialUploadType === 'lora' ? 'Upload New LoRA' : 'Upload New Video'}
          </DialogTitle>
          {/* Optional: Add DialogDescription here */}
        </DialogHeader>
        <div className="py-4 max-h-[80vh] overflow-y-auto">
          <UploadContent 
            initialUploadType={initialUploadType}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;
