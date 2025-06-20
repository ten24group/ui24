import React, { createContext, useContext, ReactNode, useState, useRef } from 'react';
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
    useSearch?: boolean;
    headers?: Record<string, string>;
}

interface IApiContext {
    callApiMethod: <T>(apiConfig: IApiConfig) => Promise<AxiosResponse<T>>;
}

const ApiContext = createContext<IApiContext | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, config } = useUi24Config()
    const { notifyError } = useAppContext()
    const { requestHeaders, processToken, logout, refreshToken } = useAuth();
    const [ isRefreshing, setIsRefreshing ] = useState(false);
    const failedQueue = useRef<any[]>([]);

    const processQueue = (error: any, token: string | null = null) => {
        failedQueue.current.forEach(prom => {
            if (error) {
                prom.reject(error);
            } else {
                prom.resolve(token);
            }
        });

        failedQueue.current = [];
    };

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
        (response) => {
            processToken(response)
            return response;
        },
        async (error) => {
            const originalRequest = error.config;
            const status = error.response?.status;

            if ((status === 401 || status === 403) && !originalRequest._retry) {
                if (isRefreshing) {
                    return new Promise(function (resolve, reject) {
                        failedQueue.current.push({ resolve, reject });
                    }).then(token => {
                        // The request interceptor will add the new token
                        return axiosInstance(originalRequest);
                    }).catch(err => {
                        return Promise.reject(err);
                    });
                }

                originalRequest._retry = true;
                setIsRefreshing(true);

                try {
                    const newToken = await refreshToken();
                    if (newToken) {
                        processQueue(null, newToken);
                        return axiosInstance(originalRequest);
                    } else {
                        // if refresh token is invalid, logout user
                        const refreshError = new Error("Session expired. Please log in again.");
                        processQueue(refreshError, null);
                        notifyError(refreshError.message);
                        logout();
                        return Promise.reject(refreshError);
                    }
                } catch (e: any) {
                    processQueue(e, null);
                    notifyError(e.message || 'Your session is invalid. Please log in again.');
                    logout();
                    return Promise.reject(e);
                } finally {
                    setIsRefreshing(false);
                }
            }

            // For other errors, just reject
            return Promise.reject(error);
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
            // The interceptor now handles 401/403, so we only need to handle other errors here.

            // Handle network errors or other errors where response is not available
            if (!error.response) {
                const networkError = {
                    message: error.message || 'Network error: No response received',
                    response: { status: 503, data: { message: 'Service Unavailable' } }
                };
                throw networkError;
            }

            // For all other API errors, normalize the error object.
            const status = error.response.status;
            const responseData = error.response.data;
            const parsedErrorMessage = responseData?.details?.message ||
                responseData?.message ||
                responseData?.error ||
                error.message ||
                'An unexpected error occurred';

            const formattedError = {
                message: parsedErrorMessage,
                response: {
                    status,
                    data: {
                        message: parsedErrorMessage,
                        ...responseData
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