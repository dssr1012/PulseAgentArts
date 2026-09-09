'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { Transaction } from '@/types';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { EmptyState } from '@/components/ui/Tabs';
import { TrendingUp } from 'lucide-react';

interface TrendChartProps {
  transactions: Transaction[];
}

export function TrendChart({ transactions }: TrendChartProps) {
  const data = useMemo(() => {
    const months: { month: string; income: number; expenses: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthLabel = format(date, 'MMM', { locale: es });

      let income = 0;
      let expenses = 0;

      transactions.forEach((t) => {
        const tDate = new Date(t.transaction_date);
        if (isWithinInterval(tDate, { start: monthStart, end: monthEnd })) {
          if (t.type === 'income') income += t.amount;
          else expenses += t.amount;
        }
      });

      months.push({ month: monthLabel, income, expenses });
    }

    return months;
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
        <EmptyState
          icon={<TrendingUp className="h-12 w-12" />}
          title="No data yet"
          description="Add transactions to see the monthly trend."
        />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg bg-white p-3 shadow-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
          {payload.map((entry) => (
            <p key={entry.dataKey} className="text-xs" style={{ color: entry.color }}>
              {entry.dataKey === 'income' ? 'Income' : 'Expenses'}: ${entry.value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trend</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickFormatter={(value: number) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#colorIncome)"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#colorExpenses)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-pulse-emerald-500" />
          <span className="text-xs text-gray-600">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-pulse-red-500" />
          <span className="text-xs text-gray-600">Expenses</span>
        </div>
      </div>
    </div>
  );
}