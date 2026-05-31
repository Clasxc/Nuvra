// src/components/Logo.tsx — NUVRA brand mark
// A rounded square in indigo→purple gradient, with a stylized "N" formed by
// two vertical strokes and a rising diagonal (suggesting growth/learning).
// A small spark in the upper-right corner hints at the AI capability.

import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

export const Logo = ({ size = 32, className, withWordmark = false }: LogoProps) => {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="NUVRA logo"
      >
        <defs>
          <linearGradient id="nuvra-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="nuvra-spark" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Rounded gradient background */}
        <rect width="40" height="40" rx="10" fill="url(#nuvra-bg)" />

        {/* Stylized N: left vertical, diagonal, right vertical */}
        <path
          d="M11 28 V12 L29 28 V12"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Spark in upper-right corner — hints at AI */}
        <circle cx="31" cy="9" r="2.5" fill="url(#nuvra-spark)" />
        <circle cx="31" cy="9" r="1" fill="white" opacity="0.9" />
      </svg>

      {withWordmark && (
        <span className="font-bold tracking-tight text-xl text-sat-primary">
          NUVRA
        </span>
      )}
    </span>
  );
};

export default Logo;
