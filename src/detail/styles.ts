// Styles for details pages - clean, minimal
export const detailsStyles = {
  // Container styles for details
  container: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start' as const,
    width: '100%',
    flexWrap: 'wrap' as const,
  },

  // Column styles - no card styling, clean layout
  column: {
    flex: 1,
    minWidth: 300,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
    padding: '8px 12px',
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
    maxWidth: '100%',
  },
};
