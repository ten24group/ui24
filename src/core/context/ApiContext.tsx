import React, { createContext, useContext, ReactNode } from 'react';
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuth } from './AuthContext';
import { useUi24Config } from './UI24Context';
import { useAppContext } from './AppContext';

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

    const { requestHeaders, processToken, logout, getToken } = useAuth();

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
        }, async (error) => {
            const originalRequest = error.config;

            // Handle session expiration
            if (error.response?.status === 401 ||
                error.response?.status === 403 ||
                (error.response?.status === 500 && error.response.data?.message?.includes?.("Invalid ID-Token"))) {

                // Show appropriate message based on error type
                if (error.response?.status === 401) {
                    notifyError('Your session has expired. Please log in again.');
                } else if (error.response?.status === 403) {
                    notifyError('Your session has expired. Please log in again.');
                } else if (error.response?.status === 500 && error.response.data?.message?.includes?.("Invalid ID-Token")) {
                    notifyError('Your session is invalid. Please log in again.');
                }

                // Attempt to refresh token if we have one
                const currentToken = getToken();
                if (currentToken) {
                    try {
                        const refreshResponse = await axiosInstance.post('/mauth/refreshToken', {
                            refreshToken: currentToken
                        });

                        if (refreshResponse.data?.IdToken) {
                            processToken(refreshResponse);
                            // Retry the original request
                            return axiosInstance(originalRequest);
                        }
                    } catch (refreshError) {
                        console.error('Token refresh failed:', refreshError);
                    }
                }

                // If refresh failed or no token, logout
                logout();
            }

            return Promise.reject(error.response)
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

            // Handle axios errors
            if (error.isAxiosError) {
                const status = error.response?.status || 500;
                const message = error.data?.details?.message || error.details?.message || error.response?.data?.message || error.message;
                error.response = {
                    status,
                    data: {
                        message: message || `API request failed with status ${status}`,
                        ...error.response?.data
                    }
                };
                throw error;
            }
            // Handle other errors
            const status = error?.response?.status || 500;
            const parsedErrorMessage = error.data?.details?.message ||
                error?.details?.message ||
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                'An unexpected error occurred';

            console.error(`API Error (${status}):`, parsedErrorMessage, error);

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