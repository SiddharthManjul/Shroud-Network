"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Shield,
  Zap,
  Code2,
  Key,
  Globe,
  Server,
  type LucideIcon,
} from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
  index: number;
}

function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  index,
}: FeatureCardProps) {
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

  const chamferSize = 24;
  const strokeWidth = 1;

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
        "group relative flex flex-col justify-between overflow-hidden bg-transparent transition-all duration-500 hover:bg-white/5",
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
          stroke="#acf901"
          strokeWidth={strokeWidth}
          strokeOpacity={0.4}
        />
      </svg>

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

      <div className="relative z-30 p-8 flex flex-col h-full">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-[#acf901]/10 text-[#acf901] transition-all duration-500 group-hover:scale-110 group-hover:bg-[#acf901]/20">
          <Icon className="h-7 w-7" />
        </div>

        <div className="mt-auto">
          <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-[#acf901] transition-colors duration-300">
            {title}
          </h3>
          <p className="text-sm text-[#888888] leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 p-4 opacity-5 transition-transform duration-500 group-hover:scale-[2] group-hover:opacity-10">
        <Icon className="h-28 w-28 text-[#acf901]" />
      </div>
    </motion.div>
  );
}

const features = [
  {
    title: "Simple SDK",
    description:
      "Import @shroud/sdk, initialize with your API key, and start building. Deposit, transfer, and withdraw — all in a few lines of TypeScript.",
    icon: Code2,
    className: "md:col-span-2",
  },
  {
    title: "Client-Side Proofs",
    description:
      "ZK proofs generated locally in the browser or Node.js via WASM. Your users' private data never leaves their device.",
    icon: Shield,
    className: "md:col-span-2",
  },
  {
    title: "Gasless Relay",
    description:
      "Users don't need AVAX. The SDK submits transactions through our relay service — gas fees handled for you.",
    icon: Zap,
    className: "md:col-span-2",
  },
  {
    title: "API Key Auth",
    description:
      "Rate-limited API keys with separate live and test environments. Manage keys, track usage, and control access from the dashboard.",
    icon: Key,
    className: "md:col-span-3",
  },
  {
    title: "Avalanche Native",
    description:
      "Built for Avalanche C-Chain with sub-second finality. Multi-token support — USDC, AVAX, and any ERC20.",
    icon: Globe,
    className: "md:col-span-3",
  },
  {
    title: "Server-Side Proofs",
    description:
      "Optionally offload proof generation to our API for serverless environments. Witness data encrypted in transit, never stored.",
    icon: Server,
    className: "md:col-span-3",
  },
  {
    title: "WebSocket Notifications",
    description:
      "Real-time note notifications via WebSocket. Know instantly when your users receive shielded transfers.",
    icon: Zap,
    className: "md:col-span-3",
  },
];

export function FeatureGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDimensions, setContainerDimensions] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const chamferSize = 48;
  const strokeWidth = 1;

  const getOuterPath = (w: number, h: number, c: number) => {
    const o = strokeWidth / 2;
    return `M ${o} ${o} L ${w - c - o} ${o} L ${w - o} ${c + o} L ${w - o} ${h - o} L ${c + o} ${h - o} L ${o} ${h - c - o} Z`;
  };

  return (
    <div
      ref={containerRef}
      className="relative py-12 px-6 md:px-12 overflow-hidden mx-4 md:mx-16 lg:mx-32 bg-black/50 backdrop-blur-md"
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
          d={getOuterPath(
            containerDimensions.width,
            containerDimensions.height,
            chamferSize
          )}
          fill="none"
          stroke="#acf901"
          strokeWidth={strokeWidth}
          strokeOpacity={0.3}
        />
      </svg>

      <div className="container mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mx-auto auto-rows-[240px]">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
