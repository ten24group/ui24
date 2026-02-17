/**
 * Shared utility for generating preview text from various content types.
 * Used by table column renderers to show inline content previews.
 */

/**
 * Generate preview text with ellipsis for text-heavy content.
 * Supports BlockNote blocks (wysiwyg/rich-text), plain strings (code/markdown/textarea).
 *
 * @param content - The content to preview
 * @param maxLength - Maximum character length before truncating (default: 32)
 * @returns A short preview string
 */
export function generateContentPreview(content: unknown, maxLength: number = 32): string {
  if (!content) return '';

  try {
    // BlockNote blocks (rich-text/wysiwyg) - structured array format
    if (Array.isArray(content)) {
      const extractTextFromBlock = (block: any): string => {
        let text = '';
        if (block.content && Array.isArray(block.content)) {
          text += block.content.map((item: any) => item.text || '').join('');
        }
        if (block.children && Array.isArray(block.children)) {
          text += ' ' + block.children.map(extractTextFromBlock).filter(Boolean).join(' ');
        }
        return text;
      };

      const plainText = content.map(extractTextFromBlock).filter(Boolean).join(' ').trim();
      return plainText
        ? (plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText)
        : '';
    }

    // Plain strings (code, markdown, textarea, longtext)
    if (typeof content === 'string') {
      const cleaned = content.trim();
      return cleaned
        ? (cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned)
        : '';
    }

    return '';
  } catch {
    return '';
  }
}
