'use client';

import React, { useState } from 'react';
import type { StatementPreview, StatementItem } from '@/types';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Check, X, Edit2, Calendar, DollarSign, CreditCard } from 'lucide-react';

interface StatementPreviewProps {
  preview: StatementPreview;
  onConfirm: () => void;
  onReject: () => void;
}

export function StatementPreviewComponent({ preview, onConfirm, onReject }: StatementPreviewProps) {
  const [items, setItems] = useState<StatementItem[]>(preview.items);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const updateItem = (index: number, field: keyof StatementItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <div className="space-y-6">
      {/* Statement Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-xs text-gray-500">Close Date</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(preview.closing_date)}</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-xs text-gray-500">Due Date</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{formatDate(preview.due_date)}</p>
        </div>
        <div className="p-3 rounded-lg bg-pulse-red-50">
          <p className="text-xs text-pulse-red-500">Total</p>
          <p className="text-sm font-semibold text-pulse-red-600 mt-1">
            {formatCurrency(preview.total_amount, preview.currency)}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-pulse-yellow-50">
          <p className="text-xs text-pulse-yellow-600">Min Payment</p>
          <p className="text-sm font-semibold text-pulse-yellow-700 mt-1">
            {formatCurrency(preview.min_payment, preview.currency)}
          </p>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Line Items ({items.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Currency</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600">
                    {editingIndex === index ? (
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => updateItem(index, 'date', e.target.value)}
                        className="input-field text-xs py-1"
                      />
                    ) : (
                      formatDate(item.date)
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {editingIndex === index ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="input-field text-xs py-1"
                      />
                    ) : (
                      item.description
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-pulse-red-500 font-medium">
                    {editingIndex === index ? (
                      <input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="input-field text-xs py-1 text-right"
                      />
                    ) : (
                      formatCurrency(item.amount, item.currency)
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{item.currency}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                      className="p-1 rounded-md text-gray-400 hover:text-pulse-blue-500 hover:bg-pulse-blue-50"
                      aria-label={editingIndex === index ? 'Done editing' : 'Edit item'}
                    >
                      {editingIndex === index ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button onClick={onReject} className="btn-secondary flex items-center gap-2">
          <X className="h-4 w-4" />
          Reject
        </button>
        <button onClick={onConfirm} className="btn-primary flex items-center gap-2">
          <Check className="h-4 w-4" />
          Confirm & Create Expenses
        </button>
      </div>
    </div>
  );
}