import React, { useState } from 'react';
import { Upload, UploadProps, GetProp, Input, InputProps, UploadFile } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';

import { GetSignedUploadUrlAPIConfig, useCustomS3Uploader } from './s3FileUploader';

type FileType = Parameters<GetProp<UploadProps, 'beforeUpload'>>[0];


export type ImageUploaderProps = Exclude<UploadProps, 'maxCount' | 'customRequest' | 'showUploadList' | 'accept'> & InputProps &  {
  fileNamePrefix?: string;
  listType?: 'picture-card' | 'picture' | 'text';
  accept?: string;
  onChange?: (value: string) => void;
  getSignedUploadUrlAPIConfig ?: GetSignedUploadUrlAPIConfig,
  withImageCrop?: boolean;
}

const SingleImageUploader = (props: ImageUploaderProps ) => {
  let { 

    accept= 'image/*', 
    listType='picture-card', 
    withImageCrop = false,
    fileNamePrefix = '', 
    getSignedUploadUrlAPIConfig, 

    readOnly= false,

    value, 
    onChange: customOnChange,
    ...restProps 
  } = props;

  const [loading, setLoading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string>(value as string);
  
  const customS3Uploader = useCustomS3Uploader({ fileNamePrefix, getSignedUploadUrlAPIConfig });

  const handleChange: UploadProps['onChange'] = (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
    } 
    else if(info.file.status === 'error') {
      setLoading(false);
    }
    else if (info.file.status === 'done') {
      const uploadedImageUrl = info.file.response.data.url as string;
      const uploadedFileName = info.file.response.data.name;
      setImageUrl(uploadedImageUrl);
      customOnChange(uploadedImageUrl);
      setLoading(false);
    }
  };
  
  const handlePreview = async (file: UploadFile) => {
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

  const uploadButton = (
    <button style={{ border: 0, background: 'none' }} disabled={loading} type="button">
      {loading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>Upload</div>
    </button>
  );

  const imageUploader = (
    <Upload
      listType="picture-card"
      className="avatar-uploader"

      maxCount={1}
      disabled={loading || readOnly}

      showUploadList={true}
      
      onChange={handleChange}
      onPreview={handlePreview}
      onRemove={() => setImageUrl('')}
      customRequest={customS3Uploader as any}
    >
      {!readOnly && uploadButton}
      { imageUrl && !readOnly && <Input type="hidden" value={imageUrl} {...restProps} />}
    </Upload>
  )

  return (
    <>
      { withImageCrop && <ImgCrop zoomSlider aspectSlider rotationSlider showGrid quality={1}>{imageUploader}</ImgCrop>}
      { !withImageCrop && imageUploader}
    </>
  )
};

export default SingleImageUploader;