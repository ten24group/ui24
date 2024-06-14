import { callApiMethod } from "../../api/apiMethods";
import axios, { AxiosProgressEvent, AxiosResponse } from "axios";

export type GetSignedUploadUrlAPIConfig  = {
  apiUrl: string;
  apiMethod: 'GET' | 'POST';
};

export type GetSignedUploadURLResponse = {
    fileName: string,
    expiresIn: number,
    contentType: string,
    signedUploadURL: string,
};

export type UseS3FileUploaderOptions = {
  fileNamePrefix?: string;
  getSignedUploadUrlAPIConfig: GetSignedUploadUrlAPIConfig;
}

export type S3FileUploaderSuccessResponse = AxiosResponse<{name: string, url: string }, any>;

export type OnErrorCallback = (error: any) => void;
export type OnSuccessCallback = (response: S3FileUploaderSuccessResponse ) => void;
export type OnProgressCallback = (progress: {percent: string}) => void;

export type S3FileUploaderOptions = {
  file: File,
  onError: OnErrorCallback,
  onSuccess: OnSuccessCallback,
  onProgress: OnProgressCallback
};

export const useS3FileUploader = ({fileNamePrefix, getSignedUploadUrlAPIConfig}: UseS3FileUploaderOptions) => ({ file, onError, onSuccess, onProgress }: S3FileUploaderOptions ) => {
  
  const signedUrlPayload = { 
    fileName: file.name, 
    contentType: file.type,
    fileNamePrefix,
  };
  
  callApiMethod({
    ...getSignedUploadUrlAPIConfig, 
     payload: signedUrlPayload  
  })
  .then( async (response) => {

      if(!response.status || response.status !== 200) {
        throw new Error('Error getting signed upload-URL');
      }

      let signedResponse = response.data as GetSignedUploadURLResponse;

      // upload the image to S3
      const uploadResponse = await axios.put(
        signedResponse.signedUploadURL, 
        file, 
        {
          // Put the fileType in the headers for the upload
          headers: { 'Content-Type': file.type },
          onUploadProgress: (event: AxiosProgressEvent) => {
            const data = { percent: Math.round((event.loaded / event.total) * 100).toFixed(2) };            
            onProgress(data);
          }
        }
      );
      
      uploadResponse.data = uploadResponse.data || {
        uid: file['uid'],
        url: signedResponse.signedUploadURL.split('?')[0],
        name: signedResponse.fileName,
      };
      
      onSuccess(uploadResponse);
  })
  .catch((error) => {
    console.error('Error getting signed URL', error);
    onError(error);
  })
};