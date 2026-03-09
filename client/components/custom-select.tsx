"use client";

import { useState, useRef, useEffect } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Compact mode for navbar-style usage */
  compact?: boolean;
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  compact = false,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const triggerClass = compact
    ? "flex items-center justify-between gap-2 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-2.5 py-1 text-sm cursor-pointer hover:border-[#acf901]/50 transition-colors duration-200"
    : "flex items-center justify-between w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 cursor-pointer hover:border-[#acf901]/50 transition-colors duration-200";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`${triggerClass} ${disabled ? "opacity-40 cursor-not-allowed" : ""} ${open ? "border-[#acf901]" : ""}`}
      >
        <span className={`truncate ${selected ? "text-[#acf901]" : "text-[#444444]"} ${compact ? "text-sm" : ""}`}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] py-1 shadow-lg shadow-black/50 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-sm transition-colors duration-150 ${
                option.value === value
                  ? "bg-[#acf901]/10 text-[#acf901]"
                  : "text-[#888888] hover:bg-[#acf901]/5 hover:text-[#acf901]"
              }`}
            >
              {option.label}
            </button>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-[#444444]">No options</p>
          )}
        </div>
      )}
    </div>
  );
}
