import { axiosInstance } from './config';

export const getMethod = async (url: string, params: any = {}, headers: any ={}) => {
    return await axiosInstance.get(url, { params, headers });
}

export const postMethod = async (url: string, data: any, headers: any ={}) => {
    return await axiosInstance.post(url, data, { headers });
};

export const putMethod = async (url: string, data: any, headers: any ={} ) => {

    return await axiosInstance.put(url, data, { headers });
};

export const patchMethod = async (url: string, data: any, headers: any ={}) => {
    return await axiosInstance.patch(url, data, { headers });
};

export const deleteMethod = async (url: string, params: any = {}, headers: any ={}) => {
    return await axiosInstance.delete(url, { params, headers });
}; 

export const optionsMethod = async (url: string, params: any = {}, headers: any ={}) => {
    return await axiosInstance.options(url, { params, headers });
};

export const headMethod = async (url: string, params: any = {}, headers: any ={}) => {
    return await axiosInstance.head(url, { params, headers });
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
        const status = error.response?.status || 500;
        const parsedErrorMessage = error.response?.data?.message || error.response?.data?.error  || `(${error.name}) ${error.message ?? 'Error in API call'}: (${status})`;
        console.error(parsedErrorMessage, error);

        return {
            ...error.response?.data,
            status,
            error: error.response?.data?.error || parsedErrorMessage,
            message: error.response?.data?.message || parsedErrorMessage,
        }
    }
    
}