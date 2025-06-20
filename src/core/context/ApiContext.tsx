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
    dedupe?: boolean;
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
    // Track ongoing requests to prevent duplicates (e.g., due to StrictMode double mount)
    const ongoingRequestsRef = useRef<Map<string, Promise<AxiosResponse<any>>>>(new Map());

    // Helper to stable stringify objects with sorted keys for consistent dedupe keys
    const stableStringify = (obj: any): string => {
        return JSON.stringify(obj, (_, value) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return Object.keys(value).sort().reduce((result: any, key: string) => {
                    result[ key ] = (value as any)[ key ];
                    return result;
                }, {});
            }
            return value;
        });
    };

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

    const callApiMethod = async <T,>(apiConfig: IApiConfig & { dedupe?: boolean }): Promise<AxiosResponse<T>> => {
        const method = apiConfig.apiMethod.toUpperCase();
        // Only dedupe GET requests by default; opt-out by setting dedupe: false or opt-in for others by dedupe: true
        const shouldDedupe = apiConfig.dedupe !== false && (method === 'GET');
        // Build stable key from method, url, payload, headers
        const keyParts = [ method, apiConfig.apiUrl ];
        if (apiConfig.payload !== undefined) {
            keyParts.push(stableStringify(apiConfig.payload));
        }
        if (apiConfig.headers) {
            keyParts.push(stableStringify(apiConfig.headers));
        }

        const key = keyParts.join('|');
        if (shouldDedupe && ongoingRequestsRef.current.has(key)) {
            return ongoingRequestsRef.current.get(key)! as Promise<AxiosResponse<T>>;
        }

        // Wrapped request executor
        const executor = async (): Promise<AxiosResponse<T>> => {

            // Mock support
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

            // Real request
            try {
                let response: AxiosResponse<T> | undefined;
                if (method === 'GET') {
                    response = await getMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'POST') {
                    response = await postMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'PUT') {
                    response = await putMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'PATCH') {
                    response = await patchMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'DELETE') {
                    response = await deleteMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'OPTIONS') {
                    response = await optionsMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'HEAD') {
                    response = await headMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                }

                if (!response) {
                    throw {
                        message: 'No response received from API call',
                        response: { status: 503, data: { message: 'Service Unavailable' } },
                    };
                }

                return response;

            } catch (error: any) {
                // propagate normalized errors
                if (!error.response) {
                    throw {
                        message: error.message || 'Network error: No response received',
                        response: { status: 503, data: { message: 'Service Unavailable' } },
                    };
                }

                // For all other API errors, normalize the error object.
                const status = error.response.status;
                const responseData = error.response.data;
                const parsedErrorMessage = responseData?.details?.message
                    || responseData?.message
                    || responseData?.error
                    || error.message
                    || 'An unexpected error occurred';

                throw {
                    message: parsedErrorMessage,
                    response: { status, data: { message: parsedErrorMessage, ...responseData } },
                };
            }
        };

        // Execute with optional dedupe tracking
        if (shouldDedupe) {
            // execute the request
            const promise = executor();
            // track the request
            ongoingRequestsRef.current.set(key, promise as Promise<AxiosResponse<any>>);
            // auto-cleanup
            promise.finally(() => {
                ongoingRequestsRef.current.delete(key);
            });
            // return the promise to the caller
            return promise;
        }

        // For non-deduped requests, just execute the request
        return executor();
    };

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