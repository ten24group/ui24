// StatWidget mock data provider

export const getStatWidgetMockData = async (apiUrl: string) => {
  switch (apiUrl) {
    case '/mock/sales/total':
      return {
        value: 126560,
        trend: { value: '12%', direction: 'down' },
        secondary: {
          value: '¥12,423',
          trend: { value: '11%', direction: 'up' }
        }
      };
    case '/mock/visits/total':
      return {
        value: 234567,
        trend: { value: '5%', direction: 'up', color: '#52c41a', label: 'WoW' },
        secondary: {
          value: '1,234'
        }
      };
    case '/mock/payments/total':
      return {
        value: 5467234,
        trend: { value: '2%', direction: 'down', color: '#ff4d4f', label: 'WoW' }
      };
    case '/mock/users/active':
      return {
        value: 123456,
        secondary: {
          value: '3%',
          trend: { value: '1%', direction: 'up', color: '#52c41a', label: 'MoM' }
        }
      };
    case '/mock/none':
      return {
        value: 4323,
        secondary: {
          value: 'N/A'
        }
      };
    case '/mock/starred':
      return {
        value: 12,
        trend: { value: '8%', direction: 'up', color: '#52c41a', label: 'YoY' },
        secondary: {
          value: '2,345'
        }
      };
    case '/mock/greyscale':
      return {
        value: 0,
        trend: { value: '15%', direction: 'up', color: '#52c41a', label: 'MoM' },
        secondary: {
          value: '5,678'
        }
      };
    default:
      return { value: '—' };
  }
}; 