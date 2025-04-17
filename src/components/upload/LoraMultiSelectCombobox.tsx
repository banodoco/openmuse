"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

type LoraOption = {
  id: string;
  name: string;
}

interface LoraMultiSelectComboboxProps {
  loras: LoraOption[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export function LoraMultiSelectCombobox({
  loras,
  selectedIds,
  setSelectedIds,
  placeholder = "Select LoRAs...",
  searchPlaceholder = "Search LoRAs...",
  noResultsText = "No LoRA found.",
  triggerClassName,
  disabled = false,
}: LoraMultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = React.useCallback((loraId: string) => {
    if (disabled) return;
    
    const newSelectedIds = selectedIds.includes(loraId)
      ? selectedIds.filter(id => id !== loraId)
      : [...selectedIds, loraId];
    
    setSelectedIds(newSelectedIds);
  }, [disabled, setSelectedIds, selectedIds]);

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
          <div className="flex flex-wrap gap-1">
            {selectedNames.length > 0 
              ? selectedNames.map(name => (
                  <Badge key={name} variant="secondary" className="whitespace-nowrap">
                    {name}
                  </Badge>
                ))
              : <span className="text-muted-foreground font-normal">{placeholder}</span>}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} disabled={disabled} />
          <CommandList>
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {loras.map((lora) => {
                const isSelected = selectedIds.includes(lora.id);
                return (
                  <CommandItem
                    key={lora.id}
                    value={lora.name}
                    onSelect={() => {
                      handleSelect(lora.id);
                      // Don't close the popover on selection for multi-select
                      // setOpen(false);
                    }}
                    disabled={disabled}
                    className="cursor-pointer"
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