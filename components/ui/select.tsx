"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectOption = { value: string; label: string };
type SelectProps = {
  id?: string;
  "aria-label"?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
};

function Select({
  id,
  "aria-label": ariaLabel,
  value,
  onValueChange,
  options,
  className,
  disabled,
  placeholder,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-[100] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        >
          <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-0.5">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-2.5 pr-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex h-4 w-4 items-center justify-center">
                  <Check className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export { Select };
