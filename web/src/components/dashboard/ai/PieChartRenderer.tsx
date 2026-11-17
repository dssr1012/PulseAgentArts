'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Widget } from './ai-dashboard-types';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="rounded-lg bg-white p-3 shadow-lg border border-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <p className="text-xs font-medium" style={{ color: entry.payload.fill }}>
          {entry.name}: ${Number(entry.value).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
        </p>
      </div>
    );
  }
  return null;
};

export function PieChartRenderer({ widget }: { widget: Widget }) {
  if (!widget.data || !widget.series) return null;
  const series = widget.series[0];
  const pieData = widget.data.map((d) => ({
    name: String(d[widget.x_key || 'name']),
    value: Number(d[series?.data_key || 'value']),
    color: series?.color || '#3B82F6',
  }));
  return (
    <div className="card">
      {widget.title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{widget.title}</h3>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
