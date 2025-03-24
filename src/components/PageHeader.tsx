
import React, { memo } from 'react';
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  buttonDisabled?: boolean;
  buttonSize?: "default" | "sm" | "lg" | "icon" | null;
}

const PageHeader: React.FC<PageHeaderProps> = memo(({ 
  title, 
  description, 
  buttonText, 
  onButtonClick, 
  buttonDisabled = false,
  buttonSize = "default"
}) => {
  return (
    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      
      <Button 
        onClick={onButtonClick}
        size={buttonSize}
        disabled={buttonDisabled}
      >
        {buttonText}
      </Button>
    </div>
  );
});

PageHeader.displayName = 'PageHeader';

export default PageHeader;
