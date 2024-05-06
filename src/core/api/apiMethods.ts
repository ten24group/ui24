import { axiosInstance } from './config';

export const useAuth = () => {
    return {
      setToken: (token: string) => {
        sessionStorage.setItem("authToken", token);
      },
      getToken: () => {
        return sessionStorage.getItem("authToken");
      }
    }
  }

export const getMethod = async (url: string, params = {}) => {
    return await axiosInstance.get(url, { params });
}

export const postMethod = async (url: string, data: any) => {
    return await axiosInstance.post(url, data);
};

export const putMethod = async (url: string, data: any) => {
    return await axiosInstance.put(url, data);
};

export const patchMethod = async (url: string, data: any) => {
    return await axiosInstance.patch(url, data);
};

export const deleteMethod = async (url: string, data: any) => {
    return await axiosInstance.delete(url, data);
}; 

export const optionsMethod = async (url: string, data: any) => {
    return await axiosInstance.options(url, data);
};

export const headMethod = async (url: string, data: any) => {
    return await axiosInstance.head(url, data);
};

export interface IApiConfig {
    apiUrl: string;
    payload?: any;
    apiMethod?: string;
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