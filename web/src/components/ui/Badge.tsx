'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'private';
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-pulse-emerald-100 text-pulse-emerald-700',
  warning: 'bg-pulse-yellow-100 text-pulse-yellow-700',
  danger: 'bg-pulse-red-100 text-pulse-red-700',
  info: 'bg-pulse-blue-100 text-pulse-blue-700',
  private: 'bg-pulse-red-100 text-pulse-red-700',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}