// Dashboard mock config for development/testing

export const dashboardMockConfig = {
    widgets: [
        {
            type: 'stat' as const,
            title: 'Total Sales',
            dataConfig: { apiUrl: '/mock/sales/total' },
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
            dataConfig: { apiUrl: '/mock/visits/total' },
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
            dataConfig: { apiUrl: '/mock/payments/total' },
            options: {
                color: '#faad14',
                icon: '💳'
            }
        },
        {
            type: 'stat' as const,
            title: 'Active Users',
            dataConfig: { apiUrl: '/mock/users/active' },
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
            dataConfig: { apiUrl: '/mock/none' },
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
            dataConfig: { apiUrl: '/mock/starred' },
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
            dataConfig: { apiUrl: '/mock/greyscale' },
            options: {
                color: '#1890ff',
                secondary: {
                    label: 'Total'
                },
                icon: {
                    name: 'ThunderboltFilled',
                    size: 48,
                    greyscale: true
                }
            }
        }
    ]
}; 