import { RcFile } from "antd/lib/upload";
import { callApiMethod } from "../../api/apiMethods";
import axios, { AxiosProgressEvent } from "axios";

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

export type UseCustomS3UploaderOptions = {
  fileNamePrefix: string;
  getSignedUploadUrlAPIConfig: GetSignedUploadUrlAPIConfig;
}

export const useCustomS3Uploader = ({fileNamePrefix, getSignedUploadUrlAPIConfig}: UseCustomS3UploaderOptions) => ({ file, onError, onSuccess, onProgress }) => {
    
  const uploadingFile = file as RcFile;

  const fileType = uploadingFile.type;
  const fileName = `${fileNamePrefix}${uploadingFile.name}`;
  
  const signedUrlPayload = { fileName, fileType };
  
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
        uploadingFile, 
        {
          // Put the fileType in the headers for the upload
          headers: { 'Content-Type': fileType },
          onUploadProgress: (event: AxiosProgressEvent) => {
            onProgress({ percent: Math.round((event.loaded / event.total) * 100).toFixed(2) });
          }
        }
      );
      
      uploadResponse.data = uploadResponse.data || {
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