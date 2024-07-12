import React, { useEffect, useState } from 'react';
import { Upload, UploadProps, GetProp, UploadFile } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import { useApi } from '../../context';
import { GetSignedUploadUrlAPIConfig, s3FileUploader } from './s3FileUploader';
import classNames from 'classnames';

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];


export type ImageUploaderProps = Exclude<UploadProps, 'maxCount' | 'customRequest' | 'showUploadList' | 'accept' | 'fileList'> &  {
  
  // Form Image picker
  accept?: string;
  listType?: 'picture-card' | 'picture' | 'text';
  withImageCrop?: boolean;
  
  // image uploader
  fileNamePrefix?: string;
  getSignedUploadUrlAPIConfig ?: GetSignedUploadUrlAPIConfig,

  // form-input
  value?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export const FileUploader = (props: ImageUploaderProps ) => {
  let { 

    className = "avatar-uploader",

    accept= '*/*', 
    listType='text', 
    withImageCrop = false,

    fileNamePrefix = '', 
    getSignedUploadUrlAPIConfig, 

    value, 
    readOnly= false,
    onChange: customOnChange,

    ...restProps 
  } = props;

  const [loading, setLoading] = useState<boolean>(false);
  const [uploadedFileList, setFileList] = useState<UploadFile[]>();
  
  const { callApiMethod } = useApi()
  useEffect(() => {
    if(!value) {
      return;
    }
    
    setFileList([
      {
        uid: undefined,
        name: value,
        status: 'done',
        url: value,
      }
    ])
  }, [value]);
  
  const defaultFileUploader = s3FileUploader({ fileNamePrefix, getSignedUploadUrlAPIConfig, callApiMethod });

  const handleChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList);

    if (info.file.status === 'uploading') {
      setLoading(true);
    } 
    else if(info.file.status === 'error') {
      setLoading(false);
    }
    else if (info.file.status === 'done') {
      const uploadedImageUrl = info.file.response.data.url as string;
      customOnChange(uploadedImageUrl);
      setLoading(false);
    }
  };
  
  const handlePreview: UploadProps['onPreview'] = async (file: UploadFile) => {
    let src = file.url as string;
    if (!src) {
      src = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file.originFileObj as FileType);
        reader.onload = () => resolve(reader.result as string);
      });
    }
    const image = new Image();
    image.src = src;
    const imgWindow = window.open(src);
    imgWindow?.document.write(image.outerHTML);
  };

  const handleRemove: UploadProps['onRemove'] = () => {
    customOnChange(undefined);
  }

  const uploadButton = (
    <button style={{ border: 0, background: 'none' }} disabled={loading} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  const imageUploader = (
    <Upload
      {...restProps}

      listType={listType}
      className={className}

      fileList={uploadedFileList}

      maxCount={1}
      disabled={loading || readOnly}
      showUploadList={true}
      
      onChange={handleChange}
      onPreview={handlePreview}
      onRemove={handleRemove}
      customRequest={defaultFileUploader as any}
    >
      {!readOnly && uploadButton}
    </Upload>
  )

  return (
    <>
      { withImageCrop && <ImgCrop 
        zoomSlider 
        aspectSlider 
        rotationSlider 
        showReset 
        showGrid 
        modalWidth={800}
        quality={1} 
        minZoom={.1}
        maxZoom={5}
        cropperProps={{
          objectFit: "contain",
          zoomSpeed: .1,
        } as any}
      >{imageUploader}</ImgCrop>}
      { !withImageCrop && imageUploader}
    </>
  )
};
