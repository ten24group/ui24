import React, { useEffect, useMemo, useState } from "react";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { Block, BlockNoteEditor, BlockNoteEditorOptions } from "@blocknote/core";
import { GetSignedUploadUrlAPIConfig, S3FileUploaderSuccessResponse, useS3FileUploader } from "./FileUploader";

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
  
  const [blocks, setBlocks] = useState<Block[]>(value);
  const [htmlContent, setHtmlContent] = useState<string>('');

  const defaultFileUploader = async (file: File): Promise<string | Record<string, any>> => {

    const upload = useS3FileUploader({
      fileNamePrefix, 
      getSignedUploadUrlAPIConfig
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

  // Creates a new editor instance.
  // We use useMemo + createBlockNoteEditor instead of useCreateBlockNote so we
  // can delay the creation of the editor until the initial content is loaded.
  const editor = useMemo(() => {
    
    let editorInst: any;
    
    if(value && Array.isArray(value) && value.length > 0) {
      editorInst = BlockNoteEditor.create({ initialContent: value, uploadFile: customFileUploader || defaultFileUploader });
    } else {
      editorInst = BlockNoteEditor.create({ uploadFile: customFileUploader || defaultFileUploader });
    }


  if(readOnly){
    editorInst.blocksToHTMLLossy(value).then((html) => {
      setHtmlContent(html);
    })
  }

    return editorInst;

  }, [value]);
 
  if (editor === undefined) {
    return "Loading contents...";
  }

  // const editor = useCreateBlockNote({ uploadFile: customFileUploader || defaultFileUploader });

  const onChange = () => {
    console.log("Editor doc has been changed:", editor.document, editor.isEditable);
    setBlocks(editor.document);
  };
  
  // notify the parent component when the editor content changes.
  const onBlur = () => {
    // notify the form about the changed content
    customOnChange && customOnChange(blocks);
  }

  // Renders the editor instance using a React component.
  return <div className={"item bordered"}>
      { readOnly && 
        <div 
          className="ma-1 pa-3 wysiwyg-html-content-wrapper" 
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        >
        </div>
      }
      { !readOnly &&
        <BlockNoteView 
          {...restProps} 
          theme={theme}
          editor={editor} 
          onBlur={onBlur}
          onChange={onChange} 
        /> 
      }
    </div>;
}
 