// ListWidget mock data provider

export const getListWidgetMockData = async (apiUrl: string) => {
  switch (apiUrl) {
    case '/mock/list/team-members':
      return {
        items: [
          { firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com' },
          { firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' },
          { firstName: 'Carol', lastName: 'Williams', email: 'carol.williams@example.com' },
          { firstName: 'David', lastName: 'Brown', email: 'david.brown@example.com' },
        ]
      };
    case '/mock/list/recent-posts':
      return {
        items: [
          { title: 'Upcoming game against Liverpool', author: 'Alice Smith', publishedDate: '2024-01-01' },
          { title: 'New signing', author: 'Bob Johnson', publishedDate: '2024-01-02' },
          { title: 'Training session', author: 'Carol Williams', publishedDate: '2024-01-03' },
          { title: 'Match report', author: 'David Brown', publishedDate: '2024-01-04' },
          { title: 'Player of the month', author: 'Eve White', publishedDate: '2024-01-05' },
        ]
      };
    default:
      return { items: [] };
  }
}; 