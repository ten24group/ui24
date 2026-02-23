import React from 'react';
import { Input, QRCode } from 'antd';
import { FileUploader } from '../../common/';
import type { BuiltInFormFieldProps, BuiltInDetailFieldProps, BuiltInTableFieldProps } from './types';
import type { FieldTypeRegistration } from '../FieldTypeRegistry';
import { resolveAnchorProps } from '../../utils/link-utils';

// ============================================================================
// Form renderers
// ============================================================================

const FileForm: React.FC<BuiltInFormFieldProps> = ({ accept, listType, fileNamePrefix, getSignedUploadUrlAPIConfig, value, onChange }) => (
  <FileUploader
    accept={accept}
    listType={(listType as 'text' | 'picture' | 'picture-card') ?? 'picture-card'}
    fileNamePrefix={fileNamePrefix}
    getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig}
    value={value}
    onChange={onChange}
  />
);

const ImageForm: React.FC<BuiltInFormFieldProps> = ({ accept, listType, withImageCrop, fileNamePrefix, getSignedUploadUrlAPIConfig, value, onChange }) => (
  <FileUploader
    accept={accept ?? 'image/*'}
    listType={(listType as 'text' | 'picture' | 'picture-card') ?? 'picture-card'}
    withImageCrop={withImageCrop ?? true}
    fileNamePrefix={fileNamePrefix}
    getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig}
    value={value}
    onChange={onChange}
  />
);

const VideoForm: React.FC<BuiltInFormFieldProps> = ({ accept, fileNamePrefix, getSignedUploadUrlAPIConfig, value, onChange }) => (
  <FileUploader
    accept={accept ?? 'video/*'}
    listType="picture-card"
    fileNamePrefix={fileNamePrefix ?? 'video-'}
    getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig}
    value={value}
    onChange={onChange}
  />
);

const AudioForm: React.FC<BuiltInFormFieldProps> = ({ accept, fileNamePrefix, getSignedUploadUrlAPIConfig, value, onChange }) => (
  <FileUploader
    accept={accept ?? 'audio/*'}
    listType="text"
    fileNamePrefix={fileNamePrefix ?? 'audio-'}
    getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig}
    value={value}
    onChange={onChange}
  />
);

const AvatarForm: React.FC<BuiltInFormFieldProps> = ({ fileNamePrefix, getSignedUploadUrlAPIConfig, value, onChange }) => (
  <FileUploader
    accept="image/*"
    listType="picture-card"
    withImageCrop={true}
    fileNamePrefix={fileNamePrefix ?? 'avatar-'}
    getSignedUploadUrlAPIConfig={getSignedUploadUrlAPIConfig}
    value={value}
    onChange={onChange}
  />
);

const QrcodeForm: React.FC<BuiltInFormFieldProps> = ({ placeholder, value, onChange, id }) => (
  <Input placeholder={placeholder || "Enter value for QR code"} value={value} onChange={onChange} id={id} />
);

// ============================================================================
// Detail renderers
// ============================================================================

const ImageDetail: React.FC<BuiltInDetailFieldProps> = ({ value, label }) => (
  <img src={String(value)} alt={label} className="details-image" />
);

const FileDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const { target, rel } = resolveAnchorProps(config.target, String(value));
  return <a href={String(value)} target={target} rel={rel}>Download File</a>;
};

const VideoDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => (
  <video
    src={String(value)}
    controls={config.controls !== false}
    style={{ maxWidth: '100%', maxHeight: '400px' }}
  />
);

const AudioDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => (
  <audio
    src={String(value)}
    controls={config.controls !== false}
    style={{ width: '100%' }}
  />
);

const QRCodeDetail: React.FC<BuiltInDetailFieldProps> = ({ value, config }) => {
  const qrSize = typeof config.size === 'number' ? config.size : 128;
  return (
    <QRCode
      value={String(value)}
      size={qrSize}
      errorLevel={config.errorLevel || 'M'}
      icon={config.logoImage}
    />
  );
};

// ============================================================================
// Table renderers
// ============================================================================

const ImageTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  const imageUrl = typeof value === 'string' ? value : '';
  if (!imageUrl) return <span>—</span>;
  return (
    <img
      src={imageUrl}
      alt="Preview"
      style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
      onClick={() => window.open(imageUrl, '_blank')}
    />
  );
};

const FileTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  const fileUrl = typeof value === 'string' ? value : '';
  if (!fileUrl) return <span>—</span>;
  const { target, rel } = resolveAnchorProps(column?.target, fileUrl);
  return <a href={fileUrl} target={target} rel={rel} style={{ color: '#1677ff' }}>Download</a>;
};

const VideoTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const { target, rel } = resolveAnchorProps(column?.target, String(value));
  return <a href={String(value)} target={target} rel={rel} style={{ color: '#1677ff' }}>Video</a>;
};

const AudioTable: React.FC<BuiltInTableFieldProps> = ({ value, column }) => {
  if (!value) return <span>—</span>;
  const { target, rel } = resolveAnchorProps(column?.target, String(value));
  return <a href={String(value)} target={target} rel={rel} style={{ color: '#1677ff' }}>Audio</a>;
};

const QRCodeTable: React.FC<BuiltInTableFieldProps> = ({ value }) => {
  if (!value) return <span>—</span>;
  return <span>QR</span>;
};

// ============================================================================
// Registrations
// ============================================================================

export const mediaRegistrations: Record<string, FieldTypeRegistration> = {
  file: {
    form: FileForm, detail: FileDetail, table: FileTable,
    defaults: { table: { width: 100 } },
  },
  image: {
    form: ImageForm, detail: ImageDetail, table: ImageTable,
    defaults: { table: { width: 80 } },
  },
  video: {
    form: VideoForm, detail: VideoDetail, table: VideoTable,
    defaults: { table: { width: 80 } },
  },
  audio: {
    form: AudioForm, detail: AudioDetail, table: AudioTable,
    defaults: { table: { width: 80 } },
  },
  avatar: { form: AvatarForm },
  qrcode: {
    form: QrcodeForm, detail: QRCodeDetail, table: QRCodeTable,
    defaults: { table: { width: 60 } },
  },
};
