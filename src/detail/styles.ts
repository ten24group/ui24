// Separate styles for details pages (no width constraints)
export const detailsStyles = {
  // Container styles for details
  container: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start' as const,
    width: '100%',
    paddingBottom: 32,
    flexWrap: 'wrap' as const,
  },

  // Column styles for details (no max width constraint)
  column: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    background: '#fff',
    padding: 24,
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    border: '1px solid #f0f0f0',
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },
}; 