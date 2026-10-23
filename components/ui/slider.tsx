import * as React from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<React.ComponentProps<"input">, "type" | "value" | "onChange"> & { value: number[]; onValueChange: (value: number[]) => void };
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(({ className, value, onValueChange, ...props }, ref) => (
  <input ref={ref} type="range" value={value[0] ?? 0} onChange={(event) => onValueChange([Number(event.target.value)])} className={cn("h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />
));
Slider.displayName = "Slider";

export { Slider };
