import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import LoRADetailsForm from '@/pages/upload/components/LoRADetailsForm';
import { useIsMobile } from '@/hooks/use-mobile';

interface AddLoRAModalProps {
  userId: string;
  triggerButtonClassName?: string;
  onSuccess?: () => void;
}

const AddLoRAModal: React.FC<AddLoRAModalProps> = ({ userId, triggerButtonClassName, onSuccess }) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  
  const handleClose = () => {
    setOpen(false);
  };

  const handleSuccess = () => {
    handleClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button className={`flex items-center gap-2 ${triggerButtonClassName}`}>
            <Plus className="h-4 w-4" /> Add LoRA
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add New LoRA</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <LoRADetailsForm onCancel={handleClose} onSuccess={handleSuccess} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={`flex items-center gap-2 ${triggerButtonClassName}`}>
          <Plus className="h-4 w-4" /> Add LoRA
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New LoRA</DialogTitle>
        </DialogHeader>
        <div className="mt-6">
          <LoRADetailsForm onCancel={handleClose} onSuccess={handleSuccess} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoRAModal;
