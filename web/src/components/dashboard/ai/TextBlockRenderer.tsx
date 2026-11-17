'use client';

import React from 'react';
import type { Widget, Tone } from './ai-dashboard-types';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<Tone, string> = {
  emerald: 'border-pulse-emerald-500 bg-pulse-emerald-50 text-pulse-emerald-800',
  red: 'border-pulse-red-500 bg-pulse-red-50 text-pulse-red-800',
  blue: 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-800',
  yellow: 'border-yellow-500 bg-yellow-50 text-yellow-800',
  info: 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-800',
  warning: 'border-yellow-500 bg-yellow-50 text-yellow-800',
  danger: 'border-pulse-red-500 bg-pulse-red-50 text-pulse-red-800',
};

export function TextBlockRenderer({ widget }: { widget: Widget }) {
  const tone = widget.tone || 'info';
  return (
    <div className={cn('rounded-xl border-l-4 p-5', TONE_STYLES[tone])}>
      {widget.title && <h3 className="text-lg font-semibold mb-3">{widget.title}</h3>}
      <div className="text-sm whitespace-pre-wrap leading-relaxed">{widget.content}</div>
    </div>
  );
}
