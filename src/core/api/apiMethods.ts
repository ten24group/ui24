import { axiosInstance } from './config';
import { useSigner } from './signer';

const signer = useSigner({});

export const getMethod = async (url: string, params = {}) => {
    const signedHeaders = await signer.sign({
        data: params,
        url: url, 
        method: 'GET', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.get(url, { params, headers: signedHeaders });
}

export const postMethod = async (url: string, data: any) => {
    const signedHeaders = await signer.sign({
        data,
        url: url, 
        method: 'POST', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.post(url, data, { headers: signedHeaders });
};

export const putMethod = async (url: string, data: any) => {
    const signedHeaders = await signer.sign({
        data,
        url: url, 
        method: 'PUT', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.put(url, data, { headers: signedHeaders });
};

export const patchMethod = async (url: string, data: any) => {
    const signedHeaders = await signer.sign({
        data,
        url: url, 
        method: 'PATCH', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.patch(url, data, { headers: signedHeaders });
};

export const deleteMethod = async (url: string, params: any = {}) => {
    const signedHeaders = await signer.sign({
        data: params,
        url: url, 
        method: 'DELETE', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.delete(url, { params: params, headers: signedHeaders });
}; 

export const optionsMethod = async (url: string, params: any = {}) => {
    const signedHeaders = await signer.sign({
        data: params,
        url: url, 
        method: 'OPTIONS', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.options(url, { params: params, headers: signedHeaders });
};

export const headMethod = async (url: string, params: any = {}) => {
    const signedHeaders = await signer.sign({
        data: params,
        url: url, 
        method: 'HEAD', 
        baseUrl: axiosInstance.defaults.baseURL
    });
    return await axiosInstance.head(url, { params: params, headers: signedHeaders });
};

export interface IApiConfig {
    apiUrl: string;
    apiMethod: string;
    payload?: any;
    responseKey?: string;
}

export const callApiMethod = async (apiConfig: IApiConfig) => {
    try{
        if( apiConfig.apiMethod.toUpperCase() === "GET" ) {
            return await getMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod.toUpperCase() === "POST" ) {
            return await postMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "PUT" ) {
            return await putMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "PATCH" ) {
            return await patchMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "DELETE" ) {
            return await deleteMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "OPTIONS" ) {
            return await optionsMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "HEAD" ) {
            return await headMethod( apiConfig.apiUrl, apiConfig.payload );
        }
    } catch (error) {
        return {
            status: error.response?.status || 500,
            error: error.response?.data?.error || "Error in API call",
            message: error.response?.data?.message || "Error in API call",
        }
    }
    
}