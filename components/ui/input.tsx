import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "luxury-input h-8 w-full min-w-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground transition-all duration-300 focus:outline-none disabled:pointer-events-none disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
