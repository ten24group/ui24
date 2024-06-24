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

  value = (value && value.length) ? value : [{ type: 'paragraph', id: '__default_block___'} as any];
  
  const [blocks, setBlocks] = useState<Block[]>(value);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const { callApiMethod }  = useApi()

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

    return Promise.resolve({props: response.data});
  };

  const editor = useCreateBlockNote({initialContent: value, uploadFile: customFileUploader || defaultFileUploader });

  if(readOnly){
    editor.blocksToHTMLLossy(value).then((html) => {
      setHtmlContent(html);
    })
  }

  const onChange = () => {
    console.log("Editor doc has been changed:", editor.document, editor.isEditable);
    setBlocks(editor.document);
    // notify the parent component when the editor content changes.
    customOnChange && customOnChange(editor.document);
  };
  
  // Renders the editor instance using a React component.
  return <div>
      { readOnly && 
        <div className="ma-1 pa-3 wysiwyg-html-content-wrapper"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        >
        </div>
      }
      { !readOnly &&
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
 