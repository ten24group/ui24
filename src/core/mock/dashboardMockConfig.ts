// Dashboard mock config for development/testing

import type { IDashboardPageConfig } from '../../pages/PostAuth/DashboardPage';

export const dashboardMockConfig: IDashboardPageConfig = {
    widgets: [
        {
            type: 'stat' as const,
            title: 'Total Sales',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/sales/total' },
            options: {
                color: '#1890ff',
                trend: {
                    label: 'vs last week',
                    upColor: '#00b96b',
                    downColor: '#d4380d'
                },
                secondary: {
                    label: 'Daily sales',
                    trend: {
                        label: 'vs yesterday',
                        upColor: '#52c41a',
                        downColor: '#faad14'
                    }
                },
                icon: '💰'
            }
        },
        {
            type: 'stat' as const,
            title: 'Visits',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/visits/total' },
            options: {
                color: '#722ed1',
                trend: {
                    label: 'WoW',
                    upColor: '#722ed1',
                    downColor: '#d4380d'
                },
                secondary: {
                    label: 'Daily visits'
                },
                icon: '👁️'
            }
        },
        {
            type: 'stat' as const,
            title: 'Payments',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/payments/total' },
            options: {
                color: '#faad14',
                icon: '💳'
            }
        },
        {
            type: 'stat' as const,
            title: 'Active Users',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/users/active' },
            options: {
                color: '#52c41a',
                secondary: {
                    label: 'Growth'
                },
                icon: '🧑‍💻'
            }
        },
        {
            type: 'stat' as const,
            title: 'No Trend Example',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/none' },
            options: {
                color: '#888',
                secondary: {
                    label: 'No trend'
                }
            }
        },
        {
            type: 'stat' as const,
            title: 'Starred Metric',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/starred' },
            options: {
                color: '#faad14',
                secondary: {
                    label: 'Favorites'
                },
                icon: { name: 'StarFilled' }
            }
        },
        {
            type: 'stat' as const,
            title: 'Greyscale Large Icon',
            colSpan: 1,
            maxWidth: 400,
            dataConfig: { apiUrl: '/mock/stat/greyscale' },
            options: {
                color: '#1890ff',
                secondary: {
                    label: 'Total'
                },
                icon: {
                    name: 'ThunderboltFilled',
                    size: 80,
                    greyscale: true
                }
            }
        },
        {
            type: 'chart' as const,
            title: 'Sales Trend',
            colSpan: 4,
            dataConfig: { apiUrl: '/mock/chart/sales/trend' },
            options: {
                type: 'line',
                xField: 'month',
                yField: 'amount',
                xAxisLabel: 'Month',
                yAxisLabel: 'Amount',
                seriesField: 'metric',
                color: '#1890ff',
                smooth: true,
                point: {
                    size: 4,
                    shape: 'circle'
                }
            }
        },
        {
            type: 'chart' as const,
            title: 'Weekly Visits',
            colSpan: 2,
            dataConfig: { apiUrl: '/mock/chart/visits/trend' },
            options: {
                type: 'bar',
                xField: 'day',
                yField: 'count',
                xAxisLabel: 'Day',
                yAxisLabel: 'Count',
                seriesField: 'metric',
                color: '#722ed1',
            }
        },
        {
            type: 'chart' as const,
            title: 'Quarterly Users',
            colSpan: 2,
            dataConfig: { apiUrl: '/mock/chart/users/trend' },
            options: {
                type: 'area',
                xField: 'quarter',
                yField: 'users',
                xAxisLabel: 'Quarter',
                yAxisLabel: 'Users',
                seriesField: 'metric',
                color: '#52c41a',
                areaStyle: {
                    fillOpacity: 0.3
                }
            }
        },
        {
            type: 'chart' as const,
            title: 'Sales vs Revenue',
            colSpan: 2,
            dataConfig: { apiUrl: '/mock/chart/multi-series' },
            options: {
                type: 'line',
                xField: 'month',
                yField: 'amount',
                xAxisLabel: 'Month',
                yAxisLabel: 'Amount',
                seriesField: 'metric',
                color: ['#1890ff', '#52c41a'],
                smooth: true,
            }
        },
        {
            type: 'chart' as const,
            title: 'Market Share',
            colSpan: 2,
            dataConfig: { apiUrl: '/mock/chart/pie/market-share' },
            options: {
                type: 'pie',
                angleField: 'value',
                colorField: 'category',
                tooltip: true,
                label: {
                  text: 'value',
                  style: {
                    fontWeight: 'bold',
                  },
                },
                legend: {
                  color: {
                    title: false,
                    position: 'right',
                    rowPadding: 5,
                  },
                },
            }
        }
    ]
}; 