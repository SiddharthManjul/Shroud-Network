'use client';

import React, { useEffect, useRef } from 'react';
import { animate, svg, stagger } from 'animejs';

export const ShroudAnim = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const lines = containerRef.current.querySelectorAll('.line');
    const drawable = svg.createDrawable(lines);

    const animation = animate(drawable, {
      draw: ['0 0', '0 1', '1 1'],
      ease: 'inOutQuad',
      duration: 2000,
      delay: stagger(100),
      loop: true,
    });

    return () => {
      animation.pause();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center">
      <svg
        viewBox="0 0 1100 350"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <style>{`
            .shroud-text {
              font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-weight: 700;
              font-size: 300px;
              letter-spacing: -0.02em;
            }
          `}</style>
        </defs>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="line shroud-text"
          stroke="#ff1a1a"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          Shroud
        </text>
      </svg>
    </div>
  );
};
