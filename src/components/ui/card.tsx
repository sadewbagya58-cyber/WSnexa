import React from 'react';
import { cn } from '@/lib/utils/cn';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
