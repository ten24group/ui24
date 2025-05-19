import { IChartDataPoint } from '../../dashboard/widgets/ChartWidget';

export const getChartWidgetMockData = async (apiUrl: string): Promise<IChartDataPoint[]> => {
  switch (apiUrl) {
    case '/mock/chart/sales/trend':
      return [
        { month: 'Jan', amount: 3500, metric: 'Sales' },
        { month: 'Feb', amount: 4200, metric: 'Sales' },
        { month: 'Mar', amount: 3800, metric: 'Sales' },
        { month: 'Apr', amount: 5100, metric: 'Sales' },
        { month: 'May', amount: 4800, metric: 'Sales' },
        { month: 'Jun', amount: 5500, metric: 'Sales' }
      ];
    case '/mock/chart/visits/trend':
      return [
        { day: 'Mon', count: 1200, metric: 'Visits' },
        { day: 'Tue', count: 1500, metric: 'Visits' },
        { day: 'Wed', count: 1800, metric: 'Visits' },
        { day: 'Thu', count: 1600, metric: 'Visits' },
        { day: 'Fri', count: 2000, metric: 'Visits' },
        { day: 'Sat', count: 2500, metric: 'Visits' },
        { day: 'Sun', count: 2200, metric: 'Visits' }
      ];
    case '/mock/chart/users/trend':
      return [
        { quarter: 'Q1', users: 5000, metric: 'Active Users' },
        { quarter: 'Q2', users: 6500, metric: 'Active Users' },
        { quarter: 'Q3', users: 8000, metric: 'Active Users' },
        { quarter: 'Q4', users: 9500, metric: 'Active Users' }
      ];
    case '/mock/chart/multi-series':
      return [
        { month: 'Jan', amount: 3500, metric: 'Sales' },
        { month: 'Feb', amount: 4200, metric: 'Sales' },
        { month: 'Mar', amount: 3800, metric: 'Sales' },
        { month: 'Apr', amount: 5100, metric: 'Sales' },
        { month: 'May', amount: 4800, metric: 'Sales' },
        { month: 'Jun', amount: 5500, metric: 'Sales' },
        { month: 'Jan', amount: 2800, metric: 'Revenue' },
        { month: 'Feb', amount: 3200, metric: 'Revenue' },
        { month: 'Mar', amount: 2900, metric: 'Revenue' },
        { month: 'Apr', amount: 3800, metric: 'Revenue' },
        { month: 'May', amount: 3500, metric: 'Revenue' },
        { month: 'Jun', amount: 4200, metric: 'Revenue' }
      ];
    case '/mock/chart/pie/market-share':
      return [
        { category: 'Product A', value: 40 },
        { category: 'Product B', value: 21 },
        { category: 'Product C', value: 17 },
        { category: 'Product D', value: 13 },
        { category: 'Product E', value: 9 },
      ];
    default:
      return [];
  }
}; 