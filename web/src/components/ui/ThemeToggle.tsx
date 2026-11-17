'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      aria-label="Toggle dark mode"
      style={{ color: isDark ? '#d1d5db' : undefined }}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
