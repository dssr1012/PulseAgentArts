'use client';

import React from 'react';
import type { Widget, Tone } from './ai-dashboard-types';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const TONE_CONFIG: Record<Tone, { style: string; Icon: React.ComponentType<{ className?: string }> }> = {
  emerald: { style: 'border-pulse-emerald-500 bg-pulse-emerald-50 text-pulse-emerald-800', Icon: CheckCircle },
  red: { style: 'border-pulse-red-500 bg-pulse-red-50 text-pulse-red-800', Icon: XCircle },
  blue: { style: 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-800', Icon: Info },
  yellow: { style: 'border-yellow-500 bg-yellow-50 text-yellow-800', Icon: AlertTriangle },
  info: { style: 'border-pulse-blue-500 bg-pulse-blue-50 text-pulse-blue-800', Icon: Info },
  warning: { style: 'border-yellow-500 bg-yellow-50 text-yellow-800', Icon: AlertTriangle },
  danger: { style: 'border-pulse-red-500 bg-pulse-red-50 text-pulse-red-800', Icon: XCircle },
};

export function AlertRenderer({ widget }: { widget: Widget }) {
  const tone = widget.tone || 'info';
  const { style, Icon } = TONE_CONFIG[tone];
  return (
    <div className={cn('rounded-xl border-l-4 p-4 flex items-start gap-3', style)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div>
        {widget.title && <h3 className="font-semibold mb-1">{widget.title}</h3>}
        <p className="text-sm">{widget.content}</p>
      </div>
    </div>
  );
}
