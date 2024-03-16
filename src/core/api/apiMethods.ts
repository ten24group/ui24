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

export interface IApiConfig {
    apiMethod?: string;
    apiUrl: string;
    payload?: any;
}
export const callApiMethod = async (apiConfig: IApiConfig) => {
    try{
        if( apiConfig.apiMethod === "GET" ) {
            return await getMethod( apiConfig.apiUrl, apiConfig.payload );
        } else if( apiConfig.apiMethod === "POST" ) {
            return await postMethod( apiConfig.apiUrl, apiConfig.payload );
        }
    } catch (error) {
        console.error("API failed for : " + apiConfig )
        return {
            status: error.response?.status || 500,
            error: error.response?.data?.error || "Error in API call",
            message: error.response?.data?.message || "Error in API call",
        }
    }
    
}