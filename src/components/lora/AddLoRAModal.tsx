
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LoRADetailsForm } from '@/pages/upload/components';
import { useMobile } from '@/hooks/use-mobile';

interface AddLoRAModalProps {
  userId: string;
  triggerButtonClassName?: string;
}

const AddLoRAModal: React.FC<AddLoRAModalProps> = ({ userId, triggerButtonClassName }) => {
  const [open, setOpen] = useState(false);
  const isMobile = useMobile();

  // Using Sheet for mobile devices and Dialog for desktop
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
            <LoRADetailsForm onCancel={() => setOpen(false)} />
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
          <LoRADetailsForm onCancel={() => setOpen(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoRAModal;
