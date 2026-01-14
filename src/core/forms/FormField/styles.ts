// Shared styles for form components
export const formStyles = {
  // Card styles (deprecated - use sparingly)
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    border: '1px solid #f0f0f0',
  },

  // Column styles - clean, minimal
  column: {
    flex: '1 1 0',
    minWidth: 300,
    maxWidth: 'calc(50% - 12px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    padding: '12px 16px',
  },

  // Container styles - minimal gap
  container: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start' as const,
    width: '100%',
    paddingBottom: 16,
    flexWrap: 'wrap' as const,
  },

  // Help text styles
  helpText: {
    fontSize: '12px',
    fontStyle: 'italic' as const,
    margin: 4,
    display: 'block' as const,
    lineHeight: '1.2',
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },

  // Label and help text container
  labelContainer: {
    marginBottom: 8,
    padding: 8,
    borderBottom: '1px dashed #2c2c2c',
  },

  // Map item container
  mapItemContainer: {
    backgroundColor: '#fafafa',
    padding: 8,
  },

  // Map card container
  mapCardContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },

  // List container
  listContainer: {
    display: 'flex',
    rowGap: 8,
    padding: 8,
    backgroundColor: '#fafafa',
    flexDirection: 'column' as const,
  },
};