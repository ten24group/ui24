import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { useUi24Config } from './UI24Context';

export interface IApiConfig {
    apiUrl: string;
    apiMethod: string;
    payload?: any;
    responseKey?: string;
}

interface IApiContext {
    callApiMethod: (apiConfig: IApiConfig) => Promise<any>;
}

const ApiContext = createContext<IApiContext | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

    const { selectConfig, config } = useUi24Config()
    const { requestHeaders, processToken, logout } = useAuth();

    //create axios instance
    const axiosInstance = axios.create();
    //set base url
    axiosInstance.defaults.baseURL = selectConfig( config => config.baseURL )

    //setup intercetors
    axiosInstance.interceptors.request.use(
        async (config) => {
            config.headers['Content-Type'] = 'application/json';
            await requestHeaders(config);
            return config;
        },
        (error) => {
            return Promise.reject(error)
        }
    );

    axiosInstance.interceptors.response.use(
        async (response) => {
            await processToken(response)
            // TODO: handle 401 and redirect to the login page
            if( response.status === 401 ) {
                logout()
            }
  
          return response;
        },
        (error) => {
            return Promise.reject(error)
        }
    );

    //** API Methods */
    const getMethod = async (url: string, params: any = {}, headers: any ={}) => {
        return await axiosInstance.get(url, { params, headers });
    }

    const postMethod = async (url: string, data: any, headers: any ={}) => {
        return await axiosInstance.post(url, data, { headers });
    };

    const putMethod = async (url: string, data: any, headers: any ={} ) => {

        return await axiosInstance.put(url, data, { headers });
    };

    const patchMethod = async (url: string, data: any, headers: any ={}) => {
        return await axiosInstance.patch(url, data, { headers });
    };

    const deleteMethod = async (url: string, params: any = {}, headers: any ={}) => {
        return await axiosInstance.delete(url, { params, headers });
    }; 

    const optionsMethod = async (url: string, params: any = {}, headers: any ={}) => {
        return await axiosInstance.options(url, { params, headers });
    };

    const headMethod = async (url: string, params: any = {}, headers: any ={}) => {
        return await axiosInstance.head(url, { params, headers });
    };
    
    const callApiMethod = async (apiConfig: IApiConfig) => {
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

    return (
        <ApiContext.Provider value={{ callApiMethod }}>
            {children}
        </ApiContext.Provider>
    );
}

export const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
      throw new Error('useApi must be used within an ApiProvider');
    }
    return context;
};

