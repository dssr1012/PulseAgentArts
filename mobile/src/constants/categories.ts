// ============================================================
// PulseExpends - Default Category Constants
// ============================================================

export interface CategoryDef {
  name: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: 'Alimentación', icon: '🍽️' },
  { name: 'Servicios', icon: '💡' },
  { name: 'Transporte', icon: '🚗' },
  { name: 'Salud', icon: '🏥' },
  { name: 'Entretenimiento', icon: '🎬' },
  { name: 'Educación', icon: '📚' },
  { name: 'Ropa', icon: '👕' },
  { name: 'Supermercado', icon: '🛒' },
  { name: 'Farmacia', icon: '💊' },
  { name: 'Café', icon: '☕' },
  { name: 'Delivery', icon: '🛵' },
  { name: 'Viajes', icon: '✈️' },
];

export const CATEGORY_GRID_COLUMNS = 4;