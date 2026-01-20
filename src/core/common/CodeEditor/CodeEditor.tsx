/**
 * CodeEditor - A CodeMirror 6 based code editor component
 * 
 * Supports multiple languages:
 * - JSON (with validation)
 * - HTML
 * - JavaScript
 * - Handlebars (plain text with highlighting)
 * - Markdown (plain text mode)
 * - Plain text
 * 
 * @example
 * <CodeEditor
 *   value={jsonString}
 *   onChange={setJsonString}
 *   language="json"
 *   height={300}
 * />
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { linter, lintGutter } from '@codemirror/lint';

export type CodeLanguage = 'json' | 'html' | 'javascript' | 'handlebars' | 'markdown' | 'text';

export interface CodeEditorProps {
  /** Current value */
  value?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Code language for syntax highlighting */
  language?: CodeLanguage;
  /** Editor height in pixels */
  height?: number;
  /** Read-only mode */
  readOnly?: boolean;
  /** Dark theme */
  darkTheme?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Enable JSON validation (only for json language) */
  validateJson?: boolean;
  /** Additional CSS class */
  className?: string;
}

// Build basic setup extensions (without line numbers - added conditionally)
function getBasicSetup(showLineNumbers: boolean): Extension[] {
  const extensions: Extension[] = [];

  // Only add line numbers and line gutter if enabled
  if (showLineNumbers) {
    extensions.push(lineNumbers());
    extensions.push(highlightActiveLineGutter());
  }

  extensions.push(
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    bracketMatching(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab,
    ])
  );

  return extensions;
}

// Get language extension based on language type
function getLanguageExtension(language: CodeLanguage, validateJson: boolean): Extension[] {
  switch (language) {
    case 'json':
      return validateJson
        ? [ json(), linter(jsonParseLinter()), lintGutter() ]
        : [ json() ];
    case 'html':
      return [ html() ];
    case 'javascript':
      return [ javascript() ];
    case 'handlebars':
      // Handlebars uses basic HTML highlighting with mustache-like syntax
      return [ html() ];
    case 'markdown':
      // Markdown uses basic text mode (can be enhanced with @codemirror/lang-markdown)
      return [];
    case 'text':
    default:
      return [];
  }
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'text',
  height = 300,
  readOnly = false,
  darkTheme = false,
  placeholder,
  lineNumbers: showLineNumbers = true,
  validateJson = true,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [ onChange ]);

  // Create/update editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Build extensions dynamically based on props
    const extensions: Extension[] = [
      ...getBasicSetup(showLineNumbers),
      ...getLanguageExtension(language, validateJson),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': {
          height: `${height}px`,
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          overflow: 'hidden',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
          fontSize: '13px',
        },
        '.cm-content': {
          minHeight: `${height - 10}px`,
        },
        '&.cm-focused': {
          outline: 'none',
          borderColor: '#4096ff',
          boxShadow: '0 0 0 2px rgba(5, 145, 255, 0.1)',
        },
      }),
    ];

    // Add theme
    if (darkTheme) {
      extensions.push(oneDark);
    }

    // Add read-only
    if (readOnly) {
      extensions.push(EditorState.readOnly.of(true));
    }

    // Add placeholder
    if (placeholder) {
      extensions.push(EditorView.contentAttributes.of({ 'aria-placeholder': placeholder }));
    }

    // Create initial state
    const state = EditorState.create({
      doc: value,
      extensions,
    });

    // Destroy previous view if exists
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    // Create new view
    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [ language, height, readOnly, darkTheme, placeholder, showLineNumbers, validateJson ]);

  // Update content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (value !== currentValue) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [ value ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%' }}
    />
  );
};

export default CodeEditor;
