"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChamferedCardProps {
  children: React.ReactNode;
  className?: string;
  chamferSize?: number;
  strokeWidth?: number;
  strokeColor?: string;
  index?: number;
  spotlight?: boolean;
}

export function ChamferedCard({
  children,
  className,
  chamferSize = 24,
  strokeWidth = 1,
  strokeColor = "#acf901",
  index = 0,
  spotlight = true,
}: ChamferedCardProps) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const updateDimensions = () => {
      if (cardRef.current) {
        setDimensions({
          width: cardRef.current.offsetWidth,
          height: cardRef.current.offsetHeight,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const getPath = (w: number, h: number, c: number) => {
    const o = strokeWidth / 2;
    return `M ${o} ${o} L ${w - c - o} ${o} L ${w - o} ${c + o} L ${w - o} ${h - o} L ${c + o} ${h - o} L ${o} ${h - c - o} Z`;
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      viewport={{ once: true }}
      className={cn(
        "group relative flex flex-col overflow-hidden bg-transparent transition-all duration-500 hover:bg-white/5",
        className
      )}
      style={{
        clipPath: `polygon(0 0, calc(100% - ${chamferSize}px) 0, 100% ${chamferSize}px, 100% 100%, ${chamferSize}px 100%, 0 calc(100% - ${chamferSize}px))`,
      }}
    >
      <svg
        className="absolute inset-0 pointer-events-none z-20"
        width="100%"
        height="100%"
      >
        <path
          d={getPath(dimensions.width, dimensions.height, chamferSize)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
        />
      </svg>

      {spotlight && (
        <motion.div
          className="pointer-events-none absolute -inset-px opacity-10 transition duration-300 group-hover:opacity-100 z-10"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                800px circle at ${mouseX}px ${mouseY}px,
                rgba(172, 249, 1, 0.12),
                transparent 80%
              )
            `,
          }}
        />
      )}

      <div className="relative z-30">{children}</div>
    </motion.div>
  );
}
