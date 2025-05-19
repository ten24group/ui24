// ListWidget mock data provider

export const getListWidgetMockData = async (apiUrl: string) => {
  switch (apiUrl) {
    case '/mock/list/team-members':
      return {
        items: [
          { userId: '1', firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com' },
          { userId: '2', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' },
          { userId: '3', firstName: 'Carol', lastName: 'Williams', email: 'carol.williams@example.com' },
          { userId: '4', firstName: 'David', lastName: 'Brown', email: 'david.brown@example.com' },
        ]
      };
    case '/mock/list/recent-posts':
      return {
        items: [
          { postId: '1', title: 'Upcoming game against Liverpool', author: 'Alice Smith', publishedDate: '2024-01-01' },
          { postId: '2', title: 'New signing', author: 'Bob Johnson', publishedDate: '2024-01-02' },
          { postId: '3', title: 'Training session', author: 'Carol Williams', publishedDate: '2024-01-03' },
          { postId: '4', title: 'Match report', author: 'David Brown', publishedDate: '2024-01-04' },
          { postId: '5', title: 'Player of the month', author: 'Eve White', publishedDate: '2024-01-05' },
        ]
      };
    default:
      return { items: [] };
  }
}; 