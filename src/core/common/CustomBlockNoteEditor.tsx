import React, { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Spin } from "antd";

import { GetSignedUploadUrlAPIConfig, S3FileUploaderSuccessResponse, s3FileUploader } from "./FileUploader";
import { useApi } from "../context";

// Lazy load BlockNote to reduce initial bundle size
const LazyBlockNoteEditor = lazy(() => import("./BlockNoteEditorImpl"));

export type BlockNoteEditorProps = {
  value?: any[],
  onChange?: (data?: any[]) => void,
  readOnly?: boolean,
  theme?: 'light' | 'dark' | any,
  fileNamePrefix?: string,
  getSignedUploadUrlAPIConfig?: GetSignedUploadUrlAPIConfig,
  uploadFile?: (file: File) => Promise<string | Record<string, any>>,
  [key: string]: any,
};
 
export const CustomBlockNoteEditor: React.FC<BlockNoteEditorProps> = (props) => {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}><Spin tip="Loading editor..." /></div>}>
      <LazyBlockNoteEditor {...props} />
    </Suspense>
  );
}
 