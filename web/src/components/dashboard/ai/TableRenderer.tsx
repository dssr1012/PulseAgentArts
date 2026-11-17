'use client';

import React from 'react';
import type { Widget } from './ai-dashboard-types';

export function TableRenderer({ widget }: { widget: Widget }) {
  if (!widget.columns || !widget.rows) return null;
  return (
    <div className="card">
      {widget.title && <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{widget.title}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {widget.columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2 font-medium text-gray-600 dark:text-gray-400 ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {widget.columns!.map((col) => {
                  const val = row[col.key];
                  const isNum = typeof val === 'number';
                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-2 ${
                        col.align === 'right' || isNum ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      } text-gray-900 dark:text-gray-100`}
                    >
                      {isNum ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
