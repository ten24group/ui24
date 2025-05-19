import React, { createContext, useContext, ReactNode } from 'react';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from './AuthContext';
import { useUi24Config } from './UI24Context';
import { useAppContext } from './AppContext';
import { getMockData } from '../mock';

export interface IApiConfig {
    apiUrl: string;
    apiMethod: string;
    payload?: any;
    responseKey?: string;
    headers?: Record<string, string>;
}

interface IApiContext {
    callApiMethod: <T>(apiConfig: IApiConfig) => Promise<AxiosResponse<T>>;
}

const ApiContext = createContext<IApiContext | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, config } = useUi24Config()
    const { notifyError } = useAppContext()

    const { requestHeaders, processToken, logout, getRefreshToken } = useAuth();

    //create axios instance
    const axiosInstance = axios.create();
    //set base url
    axiosInstance.defaults.baseURL = selectConfig(config => config.baseURL)

    //setup interceptors
    axiosInstance.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
            if (!config.headers.hasContentType()) {
                config.headers.setContentType('application/json');
            }
            await requestHeaders(config);
            return config;
        },
        (error) => {
            return Promise.reject(error)
        }
    );

    axiosInstance.interceptors.response.use(
        async (response) => {
            processToken(response)
            return response;
        },
        async (error) => {
            // Handle session expiration
            if (error.response?.status === 401 ||
                error.response?.status === 403 ||
                error.message?.includes?.("Resolved credential object is not valid") ||
                (error.response?.status === 500 &&
                    (error.response.data?.details?.message?.includes?.("Invalid ID-Token")
                        || error.response.data?.message?.includes?.("Invalid ID-Token")
                    )
                )
            ) {
                notifyError('Your session is invalid. Please log in again.');
                logout();
                return {
                    status: 401,
                    data: {
                        message: 'Your session is invalid. Please log in again.'
                    }
                };
            }

            return Promise.reject(error)
        }
    );

    //** API Methods */
    const getMethod = async (url: string, params: any = {}, headers: any = {}) => {
        return await axiosInstance.get(url, { params, headers });
    }

    const postMethod = async (url: string, data: any, headers: any = {}) => {
        return await axiosInstance.post(url, data, { headers });
    };

    const putMethod = async (url: string, data: any, headers: any = {}) => {
        return await axiosInstance.put(url, data, { headers });
    };

    const patchMethod = async (url: string, data: any, headers: any = {}) => {
        return await axiosInstance.patch(url, data, { headers });
    };

    const deleteMethod = async (url: string, params: any = {}, headers: any = {}) => {
        return await axiosInstance.delete(url, { params, headers });
    };

    const optionsMethod = async (url: string, params: any = {}, headers: any = {}) => {
        return await axiosInstance.options(url, { params, headers });
    };

    const headMethod = async (url: string, params: any = {}, headers: any = {}) => {
        return await axiosInstance.head(url, { params, headers });
    };

    const callApiMethod = async <T,>(apiConfig: IApiConfig): Promise<AxiosResponse<T>> => {
        // Universal mock support: if apiUrl starts with /mock/, return mock data
        if (apiConfig.apiUrl.startsWith('/mock/')) {
            const mockData = await getMockData(apiConfig.apiUrl);
            return {
                status: 200,
                statusText: 'OK',
                data: mockData,
                headers: { 'x-mock-response': 'true' },
                config: {},
            } as unknown as AxiosResponse<T>;
        }
        try {
            let response: AxiosResponse<T> | undefined;
            if (apiConfig.apiMethod.toUpperCase() === "GET") {
                response = await getMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod.toUpperCase() === "POST") {
                response = await postMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod === "PUT") {
                response = await putMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod === "PATCH") {
                response = await patchMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod === "DELETE") {
                response = await deleteMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod === "OPTIONS") {
                response = await optionsMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            } else if (apiConfig.apiMethod === "HEAD") {
                response = await headMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
            }

            if (!response) {
                throw new Error('No response received from API call');
            }

            return response;

        } catch (error: any) {
            // Handle network errors or no response
            if (!error) {
                const networkError = {
                    message: 'Network error: No response received',
                    response: { status: 500, data: { message: 'Network error occurred' } }
                };
                throw networkError;
            }

            // Handle other errors
            const status = error?.response?.status || 500;
            const parsedErrorMessage = error.response?.data?.details?.message ||
                error?.response?.data?.message ||
                error?.response?.details?.message ||
                error?.details?.message ||
                error.data?.details?.message ||
                error?.message ||
                error?.response?.data?.error ||
                'An unexpected error occurred';

            // Ensure error has consistent structure
            const formattedError = {
                message: parsedErrorMessage,
                response: {
                    status,
                    data: {
                        message: parsedErrorMessage,
                        ...error?.response?.data
                    }
                }
            };

            throw formattedError;
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