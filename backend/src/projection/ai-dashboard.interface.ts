// AI Dashboard spec types

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

  // kpi_cards
  cards?: KpiCard[];

  // charts (area, bar, pie, line)
  x_key?: string;
  series?: ChartSeries[];
  data?: ChartDataPoint[];

  // text_block
  content?: string;
  tone?: Tone;

  // table
  columns?: TableColumn[];
  rows?: Record<string, string | number>[];
}

export interface DashboardSpec {
  title: string;
  subtitle: string;
  insights: string[];
  widgets: Widget[];
}

// Compact financial data sent to the LLM
export interface CompactFinancialData {
  balance: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    currency: string;
  };
  projection: {
    months: Array<{
      label: string;
      income: number;
      expenses: number;
      cardPayments: number;
      netCashFlow: number;
      cumulativeBalance: number;
    }>;
    totalProjectedIncome: number;
    totalProjectedExpenses: number;
    totalProjectedCardPayments: number;
    firstSurplusMonth: string | null;
    monthlySurplus: number;
  };
  cards: Array<{
    bankName: string;
    lastFourDigits: string;
    tag: string | null;
    creditLimit: number | null;
    financingRate: number | null;
    currentBalance: number;
  }>;
  paymentStrategy: {
    recommendation: string;
    scenarios: Array<{
      name: string;
      totalInterest: number;
      monthsToDebtFree: number | null;
    }>;
  };
  investments: {
    monthlySurplus: number;
    currentInvestments: string[];
  };
}
