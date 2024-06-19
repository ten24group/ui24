import React, { useEffect, useState } from "react"

import { createReactEditorJS } from 'react-editor-js';

import Paragraph from '@editorjs/paragraph';
import Table from '@editorjs/table';
import Warning from '@editorjs/warning';
import Header from '@editorjs/header';
import Quote from '@editorjs/quote';
import Marker from '@editorjs/marker';
import List from '@editorjs/list';
import CheckList from '@editorjs/checklist';
import Delimiter from '@editorjs/delimiter';
import Code from '@editorjs/code';
import InlineCode from '@editorjs/inline-code';
import Image from '@editorjs/image';
import SimpleImage from '@editorjs/simple-image';
import LinkTool from '@editorjs/link';
import Embed from '@editorjs/embed';
import Underline from '@editorjs/underline';
import { v4 as uuidv4 } from 'uuid';

import EditorJS, { EditorConfig } from "@editorjs/editorjs";

/**
 * usages
 *
 * @example
 * 
 * ```tsx
 * import { ReactEditorJS, EDITOR_JS_TOOLS } from './Editorjs';
 * <ReactEditorJS defaultValue={blocks} tools={EDITOR_JS_TOOLS} />
 * ```
 * 
 * access to editor instance
 * 
 * ```tsx
 * const editorCore = React.useRef(null)
 * const handleInitialize = React.useCallback((instance) => {
 *      editorCore.current = instance
 * }, [])
 * 
 * const handleSave = React.useCallback(async () => {
 *      const savedData = await editorCore.current.save();
 * }, [])
 * 
 * <ReactEditorJS onInitialize={handleInitialize} defaultValue={blocks} />
 * 
 * ```
 * 
 * 
 * ! does not work with the react-router flashes and goes away
 * 
 */
export const ReactEditorJS = createReactEditorJS();



export const EDITOR_JS_TOOLS = {
  paragraph: {
    class: Paragraph,
    inlineToolbar: true,
    config: {
      preserveBlank: true,
    },
  },
  header: {
    class: Header,
    inlineToolbar: true,
    config: {
      placeholder: "Enter a header",
      levels: [1, 2, 3, 4, 5, 6],
      defaultLevel: 3,
    },
  },
  list: {
    class: List,
    inlineToolbar: true,
    config: {
      defaultStyle: "unordered",
    },
  },
  image: Image,
  checklist: {
    class: CheckList,
    inlineToolbar: true,
  },
  code: Code,
  inlineCode: InlineCode,
  table: {
    class: Table,
    inlineToolbar: true,
    config: {
      rows: 2,
      cols: 3,
      history: true,
    },
  },
  embed: Embed,
  warning: Warning,
  linkTool: LinkTool,
  quote: Quote,
  marker: Marker,
  delimiter: Delimiter,
  simpleImage: SimpleImage,
  underline: Underline,
}

export type EditorJSData = {
  time?: number
  blocks: any[]
  version?: string
};

export type EditorJSProps = Omit<EditorConfig, 'data' | 'onChange' | 'onReady'> & {
  value?: EditorJSData,
  onChange?: (data?: EditorJSData) => Promise<void> | void,
  onReady?: (editor?: EditorJS) => Promise<void> | void,
};

export const CustomEditorJs: React.FC<EditorJSProps> = ( props: EditorJSProps ) => {

  const [editorId] = useState( "editorjs-container-"+uuidv4() );

  const [isMounted, setIsMounted] = useState(false);
  
  const initEditor = ( config: EditorJSProps ) => {

    const {onChange: customOnChange, onReady: customOnReady, value, ...restConfig} = config;

    const defaultConfig: EditorConfig = {
        autofocus: true,
        holder: editorId,

        onReady: async () => {
          console.log(`Editor.js: ${editorId}, is ready to work`);
          if (customOnReady && typeof customOnReady === "function"){
            await customOnReady(editorInstance);
          }
        },

        onChange: async (api, event) => {

          if(editorInstance?.readOnly?.isEnabled) return;

          const data = await editorInstance.save();
        
          if (customOnChange && typeof customOnChange === "function"){
            await customOnChange(data);
          }
        },

        tools: EDITOR_JS_TOOLS,
    };    

    const editorInstance = new EditorJS({ ...defaultConfig, ...restConfig, data: value});
  }

  useEffect(() => {
    
    if (!isMounted) return;

    initEditor(props);

  }, [isMounted]);

  useEffect(() => {

    setIsMounted(true)

  }, []);

  return (
    <>
      <div
        id={editorId}
        className="editor-js-formats ma-1 pa-5"
      />
    </>
  )
}