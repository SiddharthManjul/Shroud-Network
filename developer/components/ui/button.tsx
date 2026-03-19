"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const futuristicButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] relative",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-lg shadow-destructive/20",
        outline:
          "bg-background text-foreground shadow-xs hover:bg-[#acf901]/10 hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-lg shadow-secondary/20",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4",
        xl: "h-12 px-8 text-base has-[>svg]:px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const defaultBorderConfig: Record<string, { width: number; color: string }> = {
  default: { width: 2, color: "rgba(172, 249, 1, 1)" },
  destructive: { width: 2, color: "rgba(239, 68, 68, 0.6)" },
  outline: { width: 2, color: "rgba(172, 249, 1, 1)" },
  secondary: { width: 2, color: "rgba(100, 116, 139, 0.6)" },
  ghost: { width: 1.5, color: "rgba(148, 163, 184, 0.4)" },
  link: { width: 0, color: "transparent" },
};

function FuturisticButton({
  className,
  variant = "default",
  size = "default",
  children,
  borderWidth,
  borderColor,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof futuristicButtonVariants> & {
    borderWidth?: number;
    borderColor?: string;
  }) {
  const chamferSize = 12;
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });

  const defaultConfig = defaultBorderConfig[variant || "default"];
  const finalBorderWidth =
    borderWidth !== undefined ? borderWidth : defaultConfig.width;
  const finalBorderColor = borderColor || defaultConfig.color;

  React.useEffect(() => {
    if (!buttonRef.current || finalBorderWidth === 0) return;

    const updateDimensions = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(buttonRef.current);

    return () => observer.disconnect();
  }, [finalBorderWidth, children]);

  const createBorderPath = (
    w: number,
    h: number,
    chamfer: number,
    strokeWidth: number
  ) => {
    const offset = strokeWidth / 2;
    return `
      M ${offset} ${offset}
      L ${w - chamfer - offset} ${offset}
      L ${w - offset} ${chamfer + offset}
      L ${w - offset} ${h - offset}
      L ${chamfer + offset} ${h - offset}
      L ${offset} ${h - chamfer - offset}
      Z
    `;
  };

  const borderSvg =
    finalBorderWidth > 0 && dimensions.width > 0 ? (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={dimensions.width}
        height={dimensions.height}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <path
          d={createBorderPath(
            dimensions.width,
            dimensions.height,
            chamferSize,
            finalBorderWidth
          )}
          fill="none"
          stroke={finalBorderColor}
          strokeWidth={finalBorderWidth}
        />
      </svg>
    ) : null;

  const chamferClip = `polygon(0 0, calc(100% - ${chamferSize}px) 0, 100% ${chamferSize}px, 100% 100%, ${chamferSize}px 100%, 0 calc(100% - ${chamferSize}px))`;

  return (
    <button
      ref={buttonRef}
      className={cn(
        futuristicButtonVariants({ variant, size }),
        "bg-transparent!",
        className
      )}
      {...props}
    >
      <span
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath: chamferClip }}
      >
        <span
          className={cn(
            "absolute inset-0",
            variant === "outline"
              ? "bg-background"
              : variant === "destructive"
                ? "bg-destructive"
                : variant === "secondary"
                  ? "bg-secondary"
                  : variant === "ghost" || variant === "link"
                    ? "bg-transparent"
                    : "bg-primary"
          )}
        />
      </span>
      {borderSvg}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}

export { FuturisticButton, futuristicButtonVariants };
