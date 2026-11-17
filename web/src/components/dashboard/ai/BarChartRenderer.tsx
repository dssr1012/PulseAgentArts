'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

export function BarChartRenderer({ widget }: { widget: Widget }) {
  if (!widget.data || !widget.series) return null;
  return (
    <div className="card">
      {widget.title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{widget.title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={widget.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey={widget.x_key} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {widget.series.map((s) => (
              <Bar key={s.data_key} dataKey={s.data_key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
