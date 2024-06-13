import React, { useState } from 'react';
import { Upload, UploadProps, Input, InputProps } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';

import { GetSignedUploadUrlAPIConfig, useCustomS3Uploader } from './s3FileUploader';

export type SingleFileUploaderProps = Exclude<UploadProps, 'maxCount' | 'customRequest' | 'showUploadList'> & InputProps &  {
  accept?: string;
  onChange?: (value: string) => void;
  fileNamePrefix?: string;
  getSignedUploadUrlAPIConfig ?: GetSignedUploadUrlAPIConfig,
}

const SingleFileUploader = (props: SingleFileUploaderProps ) => {
  let { 

    listType, 
    fileNamePrefix = '', 
    getSignedUploadUrlAPIConfig, 

    readOnly= false,

    value, 
    onChange: customOnChange,

    ...restProps 
  } = props;

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>(value as string);
  const customS3Uploader = useCustomS3Uploader({ fileNamePrefix, getSignedUploadUrlAPIConfig });

  const handleChange: UploadProps['onChange'] = (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
    } 
    else if(info.file.status === 'error') {
      setLoading(false);
    }
    else if (info.file.status === 'done') {
      const uploadedFileUrl = info.file.response.data.url as string;
      setUploadedFileUrl(uploadedFileUrl);
      customOnChange(uploadedFileUrl);
      setLoading(false);
    }
  };

  const uploadButton = (
    <button style={{ border: 0, background: 'none' }} disabled={loading} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  const fileUploader = (
    <Upload
      {...restProps}
      
      listType={listType}

      maxCount={1}
      disabled={loading || readOnly}

      showUploadList={true}
      onChange={handleChange}
      onRemove={() => setUploadedFileUrl('')}
      customRequest={customS3Uploader as any}
    >
      {!readOnly && uploadButton}
      { uploadedFileUrl && !readOnly && <Input type="hidden" value={uploadedFileUrl} {...restProps} />}
    </Upload>
  )

  return (<>{fileUploader}</>)
};

export default SingleFileUploader;