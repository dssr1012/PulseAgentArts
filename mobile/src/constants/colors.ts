// ============================================================
// PulseExpends - Color Palette Constants
// Per design §2.6.2
// ============================================================

export const Colors = {
  // Primary
  primary: '#2563EB',        // blue-600 - Balance cards, primary CTAs
  primaryLight: '#3B82F6',   // blue-500 - Hover states, active indicators
  primaryDark: '#1D4ED8',    // blue-700 - Pressed states

  // Backgrounds
  background: '#FFFFFF',     // white - Main content areas
  surface: '#F9FAFB',        // gray-50 - Card backgrounds, secondary surfaces
  surfaceDark: '#F3F4F6',    // gray-100 - Elevated surfaces

  // Semantic
  alert: '#F59E0B',          // amber-500 - Irregular expense alerts
  alertLight: '#FEF3C7',     // amber-100 - Alert background highlight
  expense: '#EF4444',        // red-500 - Expense amounts, negative balance
  expenseLight: '#FEE2E2',   // red-100 - Critical alert background
  success: '#10B981',        // emerald-500 - Income amounts, confirmations
  successLight: '#D1FAE5',   // emerald-100 - Success background

  // Text
  textPrimary: '#111827',    // gray-900 - Headings, primary text
  textSecondary: '#6B7280',  // gray-500 - Descriptions, timestamps
  textTertiary: '#9CA3AF',   // gray-400 - Disabled/hint text
  textInverse: '#FFFFFF',    // white - Text on dark backgrounds

  // Borders & Dividers
  border: '#E5E7EB',         // gray-200
  divider: '#F3F4F6',        // gray-100

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',

  // Privacy
  privacy: '#EF4444',        // red-500 - Gift Hidden Mode toggle
  privacyLight: '#FEE2E2',   // red-100 - Privacy background
} as const;

export type ColorKey = keyof typeof Colors;