'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { Category } from '@/types';
import { EmptyState } from '@/components/ui/Tabs';
import { Tag } from 'lucide-react';

const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#EF4444', // red-500
  '#10B981', // emerald-500
  '#FBBF24', // yellow-400
  '#8B5CF6', // violet-500
  '#F97316', // orange-500
  '#06B6D4', // cyan-500
  '#EC4899', // pink-500
  '#6366F1', // indigo-500
  '#84CC16', // lime-500
];

interface CategoryChartProps {
  categories: Category[];
  breakdown: Record<string, number>;
}

export function CategoryChart({ categories, breakdown }: CategoryChartProps) {
  const data = Object.entries(breakdown)
    .map(([categoryId, amount], index) => {
      const category = categories.find((c) => c.id === categoryId);
      return {
        name: category?.name || categoryId,
        value: Math.abs(amount),
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
        <EmptyState
          icon={<Tag className="h-12 w-12" />}
          title="No data yet"
          description="Add some expenses to see the breakdown by category."
        />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg bg-white p-3 shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-pulse-red-500 font-semibold">
            ${payload[0].value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span className="text-xs text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}