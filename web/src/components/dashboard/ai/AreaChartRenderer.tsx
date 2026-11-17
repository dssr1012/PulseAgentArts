'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Widget } from './ai-dashboard-types';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-white p-3 shadow-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: ${Number(entry.value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function AreaChartRenderer({ widget }: { widget: Widget }) {
  if (!widget.data || !widget.series) return null;
  return (
    <div className="card">
      {widget.title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{widget.title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={widget.data}>
            <defs>
              {widget.series.map((s) => (
                <linearGradient key={s.data_key} id={`gradient-${s.data_key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={widget.x_key} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {widget.series.map((s) => (
              <Area key={s.data_key} type="monotone" dataKey={s.data_key} name={s.name} stroke={s.color} strokeWidth={2} fill={`url(#gradient-${s.data_key})`} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
