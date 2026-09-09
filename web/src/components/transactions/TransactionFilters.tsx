'use client';

import React, { useState } from 'react';
import type { Category, TransactionQuery, Currency } from '@/types';
import { CURRENCIES } from '@/lib/utils';
import { Filter, X } from 'lucide-react';

interface TransactionFiltersProps {
  categories: Category[];
  filters: TransactionQuery;
  onFiltersChange: (filters: TransactionQuery) => void;
}

export function TransactionFilters({ categories, filters, onFiltersChange }: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof TransactionQuery, value: string | undefined) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({ page: 1, limit: 20 });
  };

  const hasActiveFilters = filters.currency || filters.category_id || filters.from_date || filters.to_date;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'ring-2 ring-pulse-blue-500' : ''}`}
        aria-expanded={isOpen}
        aria-label="Toggle filters"
      >
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filters</span>
        {hasActiveFilters && (
          <span className="inline-flex items-center justify-center rounded-full bg-pulse-blue-500 text-white h-4 w-4 text-[10px] font-bold">
            !
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-pulse-blue-500 hover:underline">
                  Clear all
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-md hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {/* Currency filter */}
            <div>
              <label className="label-field text-xs">Currency</label>
              <select
                value={filters.currency || ''}
                onChange={(e) => updateFilter('currency', e.target.value)}
                className="select-field text-sm"
              >
                <option value="">All currencies</option>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Category filter */}
            <div>
              <label className="label-field text-xs">Category</label>
              <select
                value={filters.category_id || ''}
                onChange={(e) => updateFilter('category_id', e.target.value)}
                className="select-field text-sm"
              >
                <option value="">All categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="label-field text-xs">From date</label>
              <input
                type="date"
                value={filters.from_date || ''}
                onChange={(e) => updateFilter('from_date', e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="label-field text-xs">To date</label>
              <input
                type="date"
                value={filters.to_date || ''}
                onChange={(e) => updateFilter('to_date', e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}