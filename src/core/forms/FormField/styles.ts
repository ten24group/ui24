// Shared styles for form components
export const formStyles = {
  // Card styles
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #f0f0f0',
  },
  
  // Column styles
  column: {
    flex: '1 1 0',
    minWidth: 400,
    maxWidth: 'calc(50% - 12px)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
    padding: 24,
  },
  
  // Container styles
  container: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start' as const,
    width: '100%',
    paddingBottom: 32,
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
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 0 10px 0 rgba(0, 0, 0, 0.1)',
  },
  
  // Map card container
  mapCardContainer: {
    display: 'flex',
    borderRadius: 8,
    flexDirection: 'column' as const,
    gap: 8,
  },
  
  // List container
  listContainer: {
    display: 'flex',
    rowGap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#8080801c',
    flexDirection: 'column' as const,
  },
};