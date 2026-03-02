import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#ff1a1a]/60 aria-invalid:ring-red-500/20 aria-invalid:border-red-500",
  {
    variants: {
      variant: {
        // Default: bright grey bg, black text; hover → neon red bg, black text
        default:
          "bg-[#b0b0b0] text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a]",
        // Outline: transparent bg, neon red border/text; hover → neon red bg
        outline:
          "border border-[#ff1a1a] bg-transparent text-[#ff1a1a] hover:bg-[#ff1a1a] hover:text-black",
        // Ghost: no bg; hover → subtle neon red bg
        ghost:
          "bg-transparent text-[#ff1a1a] hover:bg-[#ff1a1a]/10",
        // Secondary (same as default grey)
        secondary:
          "bg-[#b0b0b0] text-black hover:bg-[#ff1a1a] hover:text-black border border-[#b0b0b0] hover:border-[#ff1a1a]",
        // Destructive
        destructive:
          "bg-red-600 text-white hover:bg-red-500 border border-red-600",
        // Link
        link: "text-[#ff1a1a] underline-offset-4 hover:underline bg-transparent",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }