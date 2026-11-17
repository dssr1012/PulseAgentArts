'use client';

import React from 'react';
import type { Widget } from './ai-dashboard-types';
import { KpiCardsRenderer } from './KpiCardsRenderer';
import { AreaChartRenderer } from './AreaChartRenderer';
import { BarChartRenderer } from './BarChartRenderer';
import { PieChartRenderer } from './PieChartRenderer';
import { LineChartRenderer } from './LineChartRenderer';
import { TextBlockRenderer } from './TextBlockRenderer';
import { TableRenderer } from './TableRenderer';
import { AlertRenderer } from './AlertRenderer';

export function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'kpi_cards':
      return widget.cards ? <KpiCardsRenderer cards={widget.cards} /> : null;
    case 'area_chart':
      return <AreaChartRenderer widget={widget} />;
    case 'bar_chart':
      return <BarChartRenderer widget={widget} />;
    case 'pie_chart':
      return <PieChartRenderer widget={widget} />;
    case 'line_chart':
      return <LineChartRenderer widget={widget} />;
    case 'text_block':
      return <TextBlockRenderer widget={widget} />;
    case 'table':
      return <TableRenderer widget={widget} />;
    case 'alert':
      return <AlertRenderer widget={widget} />;
    default:
      return null;
  }
}
