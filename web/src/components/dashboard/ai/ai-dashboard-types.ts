export type WidgetType =
  | 'kpi_cards'
  | 'area_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'line_chart'
  | 'text_block'
  | 'table'
  | 'alert';

export type WidgetSpan = 'full' | 'half' | 'third';
export type Tone = 'emerald' | 'red' | 'blue' | 'yellow' | 'info' | 'warning' | 'danger';

export interface KpiCard {
  label: string;
  value: number;
  currency: string;
  icon?: string;
  tone: Tone;
}

export interface ChartSeries {
  name: string;
  data_key: string;
  color: string;
}

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface Widget {
  id: string;
  type: WidgetType;
  title?: string;
  span: WidgetSpan;
  cards?: KpiCard[];
  x_key?: string;
  series?: ChartSeries[];
  data?: ChartDataPoint[];
  content?: string;
  tone?: Tone;
  columns?: TableColumn[];
  rows?: Record<string, string | number>[];
}

export interface DashboardSpec {
  title: string;
  subtitle: string;
  insights: string[];
  widgets: Widget[];
}
