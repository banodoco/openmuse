"use client"

import React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
import { Logger } from '@/lib/logger';

const logger = new Logger('LoraMultiSelectCombobox');

type LoraOption = {
  id: string;
  name: string;
}

interface LoraMultiSelectComboboxProps {
  loras: LoraOption[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  placeholder?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function LoraMultiSelectCombobox({
  loras,
  selectedIds,
  setSelectedIds,
  placeholder = "Select LoRAs...",
  triggerClassName,
  disabled = false,
}: LoraMultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);

  logger.log('Rendering LoraMultiSelectCombobox. Props:', {
    lorasCount: loras.length,
    selectedIds,
    disabled,
  });

  const toggleId = React.useCallback(
    (id: string) => {
      if (disabled) return;
      const isSelected = selectedIds.includes(id);
      const newIds = isSelected
        ? selectedIds.filter((v) => v !== id)
        : [...selectedIds, id];
      logger.log('toggleId', { id, isSelected, newIds });
      setSelectedIds(newIds);
    },
    [disabled, selectedIds, setSelectedIds]
  );

  const selectedNames = React.useMemo(() => {
    return loras
      .filter(lora => selectedIds.includes(lora.id))
      .map(lora => lora.name);
  }, [loras, selectedIds]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-[2.5rem]", triggerClassName)}
          disabled={disabled}
        >
          <div className="flex flex-wrap gap-1 text-left">
            {selectedNames.length > 0 ? (
              selectedNames.map((name) => (
                <Badge key={name} variant="secondary" className="whitespace-nowrap">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72">
        <Command>
          <CommandInput placeholder="Search LoRAs..." autoFocus />
          <CommandList>
            <CommandEmpty>No LoRA found.</CommandEmpty>
            <CommandGroup>
              {loras.map((lora) => {
                const isSelected = selectedIds.includes(lora.id);
                return (
                  <CommandItem
                    key={lora.id}
                    value={lora.name}
                    onSelect={() => {
                      toggleId(lora.id);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {lora.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 