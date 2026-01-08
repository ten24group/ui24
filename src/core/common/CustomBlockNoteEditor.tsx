import React, { useEffect, useMemo, useState } from "react";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { Block, BlockNoteEditorOptions } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { GetSignedUploadUrlAPIConfig, S3FileUploaderSuccessResponse, s3FileUploader } from "./FileUploader";
import { useApi } from "../context";

export type BlockNoteEditorProps =
  Partial<Omit<BlockNoteEditorOptions<any, any, any>, 'initialContent' | 'onChange'>>
  & Omit<React.ComponentProps<typeof BlockNoteView>, 'editor'>
  & {
    value?: Block[],
    onChange?: (data?: Block[]) => void,
    readOnly?: boolean,

    fileNamePrefix?: string,
    getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig,
  };

export const CustomBlockNoteEditor: React.FC<BlockNoteEditorProps> = ({
  value,
  onChange: customOnChange,
  uploadFile: customFileUploader,

  theme = 'light',
  readOnly = false,

  fileNamePrefix = 'blocknote-uploads-',
  getSignedUploadUrlAPIConfig,

  ...restProps
}) => {

  const normalizedValue = (value && value.length) ? value : [ { type: 'paragraph', id: '__default_block___' } as any ];

  const [ blocks, setBlocks ] = useState<Block[]>(normalizedValue);
  const [ htmlContent, setHtmlContent ] = useState<string>('');
  const { callApiMethod } = useApi();

  // CRITICAL: Track when we're programmatically updating the editor to prevent onChange from overwriting form data
  // BlockNote's onChange fires when we call replaceBlocks, which would overwrite the form with stale data
  const isProgrammaticUpdateRef = React.useRef(false);

  const defaultFileUploader = async (file: File): Promise<string | Record<string, any>> => {

    const upload = s3FileUploader({
      fileNamePrefix,
      getSignedUploadUrlAPIConfig,
      callApiMethod
    });

    const response = await new Promise<S3FileUploaderSuccessResponse>((resolve, reject) => {
      upload({
        file,
        onError: (e) => {
          console.error("Block Note File Uploader on error:", e);
          reject(e);
        },
        onSuccess: (response) => {
          console.log("Block Note File Uploader on success:", response);
          resolve(response);
        },
        onProgress: (progress) => {
          console.info("Block Note File Uploader on progress:", progress);
        }
      });
    });

    return Promise.resolve({ props: response.data });
  };

  const editor = useCreateBlockNote({
    initialContent: normalizedValue,
    uploadFile: customFileUploader || defaultFileUploader
  });

  // CRITICAL: Update editor content when value prop changes (e.g., when data loads from API in edit mode)
  // This ensures the editor displays the loaded content
  useEffect(() => {
    if (editor && normalizedValue && JSON.stringify(editor.document) !== JSON.stringify(normalizedValue)) {
      // Set flag BEFORE replaceBlocks to prevent onChange from calling customOnChange
      isProgrammaticUpdateRef.current = true;

      try {
        editor.replaceBlocks(editor.document, normalizedValue);
      } catch (error) {
        console.error('[CustomBlockNoteEditor] replaceBlocks FAILED:', error);
      } finally {
        // Reset flag after a microtask to allow BlockNote's onChange to fire but be detected as programmatic
        // Using queueMicrotask ensures this runs after the synchronous replaceBlocks but before any async operations
        queueMicrotask(() => {
          isProgrammaticUpdateRef.current = false;
        });
      }
    }
  }, [ editor, JSON.stringify(normalizedValue) ]);

  if (readOnly) {
    editor.blocksToFullHTML(normalizedValue).then((html) => {
      setHtmlContent(html);
    })
  }

  const onChange = () => {
    setBlocks(editor.document);

    // CRITICAL: Only call customOnChange if this is NOT a programmatic update
    // This prevents our replaceBlocks calls from overwriting form data via the onChange callback
    if (!isProgrammaticUpdateRef.current) {
      customOnChange && customOnChange(editor.document);
    }
  };

  // Renders the editor instance using a React component.
  return <div>
    {readOnly &&
      <div className="ma-1 pa-3 wysiwyg-html-content-wrapper"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      >
      </div>
    }
    {!readOnly &&
      <BlockNoteView
        className="ma-1 pa-3 wysiwyg-wrapper"
        {...restProps}
        theme={theme}
        editor={editor}
        onChange={onChange}
      />
    }
  </div>;
}
