'use client';

import React from 'react';
import { useToast } from '@/contexts/ToastContext';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-pulse-emerald-50 border-pulse-emerald-200 text-pulse-emerald-800',
  error: 'bg-pulse-red-50 border-pulse-red-200 text-pulse-red-800',
  warning: 'bg-pulse-yellow-50 border-pulse-yellow-200 text-pulse-yellow-800',
  info: 'bg-pulse-blue-50 border-pulse-blue-200 text-pulse-blue-800',
};

const iconColorMap = {
  success: 'text-pulse-emerald-500',
  error: 'text-pulse-red-500',
  warning: 'text-pulse-yellow-500',
  info: 'text-pulse-blue-500',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = iconMap[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg ${colorMap[toast.type]}`}
              role="alert"
            >
              <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColorMap[toast.type]}`} />
              <p className="text-sm font-medium flex-1">{toast.message}</p>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}