import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LoRADetailsForm } from '@/pages/upload/components';
import { useIsMobile } from '@/hooks/use-mobile';

interface AddLoRAModalProps {
  userId: string;
  triggerButtonClassName?: string;
}

const AddLoRAModal: React.FC<AddLoRAModalProps> = ({ userId, triggerButtonClassName }) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Initial LoRA details state
  const [loraDetails, setLoraDetails] = useState({
    loraName: '',
    loraDescription: '',
    creator: 'self' as 'self' | 'someone_else',
    creatorName: '',
    model: 'wan' as 'wan' | 'hunyuan' | 'ltxv' | 'cogvideox' | 'animatediff',
    modelVariant: '',
    loraType: 'Concept' as 'Concept' | 'Motion Style' | 'Specific Movement' | 'Aesthetic Style' | 'Control' | 'Other',
    loraLink: '',
  });

  const updateLoRADetails = (field: keyof typeof loraDetails, value: string) => {
    setLoraDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleClose = () => {
    setOpen(false);
  };

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
            <LoRADetailsForm 
              loraDetails={loraDetails}
              updateLoRADetails={updateLoRADetails}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={handleClose} className="mr-2">Cancel</Button>
              <Button onClick={() => {
                // Handle submission logic here
                console.log('Submitting LoRA details:', loraDetails);
                handleClose();
              }}>Submit</Button>
            </div>
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
          <LoRADetailsForm 
            loraDetails={loraDetails}
            updateLoRADetails={updateLoRADetails}
          />
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={handleClose} className="mr-2">Cancel</Button>
            <Button onClick={() => {
              // Handle submission logic here
              console.log('Submitting LoRA details:', loraDetails);
              handleClose();
            }}>Submit</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLoRAModal;
