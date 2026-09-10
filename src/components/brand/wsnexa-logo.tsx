import React from 'react';
import Image from 'next/image';

export interface WSNexaLogoProps {
  variant?: 'full' | 'mark';
  className?: string;
  priority?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
}

/**
 * Authoritative WSNexa Logo Component
 * - 'mark': Official compact WS symbol (image/1000041108.png, 1:1 aspect ratio).
 *           Used for browser favicon, compact mobile headers, app icons, and small icon contexts.
 * - 'full': Official full WSNexa logo (image/1000041106.png, 3:1 aspect ratio).
 *           Contains "WSNexa / Smart Hospitality. Simplified."
 *           Used for public header, footer, auth, legal, help center, and large brand surfaces.
 */
export const WSNexaLogo: React.FC<WSNexaLogoProps> = ({
  variant = 'full',
  className = '',
  priority = false,
  size = 'md',
}) => {
  if (variant === 'mark') {
    // Exact 1:1 aspect ratio
    const sizeClasses: Record<string, string> = {
      sm: 'w-7 h-7',
      md: 'w-8 h-8',
      lg: 'w-10 h-10',
      xl: 'w-12 h-12',
      custom: '',
    };

    const containerSize = sizeClasses[size] || sizeClasses.md;

    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${containerSize} ${className}`}>
        <Image
          src="/brand/ws-mark.png"
          alt="WSNexa"
          width={48}
          height={48}
          className="w-full h-full object-contain rounded-lg"
          priority={priority}
        />
      </div>
    );
  }

  // variant === 'full' — Exact 3:1 aspect ratio (1536 x 512)
  const sizeClasses: Record<string, string> = {
    sm: 'w-[105px] h-[35px]',
    md: 'w-[135px] h-[45px]',
    lg: 'w-[165px] h-[55px]',
    xl: 'w-[210px] h-[70px]',
    custom: '',
  };

  const containerSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`relative inline-flex items-center shrink-0 ${containerSize} ${className}`}>
      <Image
        src="/brand/wsnexa-full-logo.png"
        alt="WSNexa - Smart Hospitality. Simplified."
        width={210}
        height={70}
        className="w-full h-full object-contain"
        priority={priority}
      />
    </div>
  );
};
