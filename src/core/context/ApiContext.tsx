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

// Separate interface for dual endpoint support (search + database)
export interface IDualApiConfig {
    search: IApiConfig;
    database: IApiConfig;
}

interface IApiContext {
    callApiMethod: <T>(apiConfig: IApiConfig) => Promise<AxiosResponse<T>>;
}

const ApiContext = createContext<IApiContext | undefined>(undefined);

export const ApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { selectConfig, config } = useUi24Config()
    const auth = useAuth();

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

    //create axios instance
    const axiosInstance = axios.create();
    //set base url
    axiosInstance.defaults.baseURL = selectConfig(config => config.baseURL)

    // Authentication interceptors
    let refreshPromise: Promise<void> | null = null;
    axiosInstance.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
            const headers = config.headers as Record<string, any>;
            if (!headers[ 'Content-Type' ] && !headers[ 'content-type' ]) {
                headers[ 'Content-Type' ] = 'application/json';
            }
            // Attach auth headers or signatures
            return await auth.authenticateRequest(config);
        },
        (error) => Promise.reject(error)
    );

    axiosInstance.interceptors.response.use(
        (response) => {
            // Process any new tokens or credentials
            try {
                auth.processResponse?.(response as any);
            } catch (error) {
                // If token processing fails (e.g., authorization error), 
                // reject with the error message properly attached
                console.error('Token processing failed:', error);
                const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
                return Promise.reject({
                    message: errorMessage,
                    response: {
                        status: 403,
                        statusText: 'Forbidden',
                        data: {
                            message: errorMessage,
                            details: {
                                message: errorMessage
                            }
                        },
                        headers: response.headers,
                        config: response.config
                    }
                });
            }
            return response;
        },
        async (error) => {
            const orig = error.config;

            const shouldRetry = auth.shouldRefreshAuth(error, orig)

            if (shouldRetry && (orig._retryCount || 0) === 0) {
                orig._retryCount = (orig._retryCount || 0) + 1;
                if (!refreshPromise) {
                    refreshPromise = auth.refreshAuth()
                        .catch((err: any) => { auth.logout(); throw err; })
                        .finally(() => { refreshPromise = null; });
                }
                try {
                    await refreshPromise;
                    // Retry original request with fresh auth
                    const newConfig = await auth.authenticateRequest(orig);
                    return axiosInstance(newConfig);
                } catch (refreshError) {
                    // On refresh failure, logout has already been called by the auth provider.
                    // The state change will trigger a redirect. We should not propagate
                    // the error further, as the original request is now irrelevant.
                    // We return a new, non-rejecting promise to prevent uncaught promise errors.
                    return Promise.reject(refreshError);
                }
            }
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
        const method = (apiConfig.apiMethod ?? 'GET').toUpperCase();
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
                    response = await postMethod(apiConfig.apiUrl, apiConfig.payload ?? {}, apiConfig.headers);
                } else if (method === 'PUT') {
                    response = await putMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'PATCH') {
                    response = await patchMethod(apiConfig.apiUrl, apiConfig.payload ?? {}, apiConfig.headers);
                } else if (method === 'DELETE') {
                    response = await deleteMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'OPTIONS') {
                    response = await optionsMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                } else if (method === 'HEAD') {
                    response = await headMethod(apiConfig.apiUrl, apiConfig.payload, apiConfig.headers);
                }

                if (!response) {
                    throw {
                        message: 'No response received from API call - this should not happen',
                        response: { 
                            status: 503, 
                            data: { 
                                message: 'No response from server',
                                errorType: 'NO_RESPONSE',
                                details: {
                                    message: 'The API method did not return a response. This is likely a framework bug.',
                                    method,
                                    url: apiConfig.apiUrl
                                }
                            } 
                        },
                    };
                }

                return response;

            } catch (error: any) {
                // Network errors, timeouts, and other non-response errors
                if (!error.response) {
                    // Determine error type and create user-friendly message
                    let errorMessage = error.message || 'Network error occurred';
                    let errorType = 'NETWORK_ERROR';
                    
                    // Categorize common error types for better user feedback
                    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                        errorType = 'TIMEOUT';
                        errorMessage = `Request timeout: ${error.message || 'The server took too long to respond'}`;
                    } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
                        errorType = 'NETWORK_ERROR';
                        errorMessage = `Network error: ${error.message || 'Unable to connect to the server'}`;
                    } else if (error.code === 'ERR_CANCELED') {
                        errorType = 'CANCELED';
                        errorMessage = 'Request was canceled';
                    } else if (error.message?.includes('ECONNREFUSED')) {
                        errorType = 'CONNECTION_REFUSED';
                        errorMessage = 'Connection refused: Unable to connect to the server';
                    } else if (error.message?.includes('ENOTFOUND')) {
                        errorType = 'DNS_ERROR';
                        errorMessage = 'DNS error: Could not resolve server address';
                    }
                    
                    const normalizedError = {
                        message: errorMessage,
                        code: error.code || errorType,
                        originalError: error.message,
                        response: { 
                            status: 503, 
                            data: { 
                                message: errorMessage,
                                errorType,
                                code: error.code,
                                details: {
                                    message: errorMessage,
                                    originalMessage: error.message,
                                    code: error.code,
                                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                                }
                            } 
                        },
                    };
                    return Promise.reject(normalizedError);
                }

                // HTTP errors with response from server
                const status = error.response.status;
                const responseData = error.response.data;
                
                // Extract the most specific error message available
                const parsedErrorMessage = responseData?.details?.message
                    || responseData?.message
                    || responseData?.error
                    || error.message
                    || `HTTP ${status} error occurred`;

                const normalizedError = {
                    message: parsedErrorMessage,
                    code: responseData?.code || responseData?.errorCode,
                    response: { 
                        status, 
                        data: { 
                            message: parsedErrorMessage, 
                            ...responseData,
                            // Ensure details are preserved
                            details: {
                                ...responseData?.details,
                                message: responseData?.details?.message || parsedErrorMessage,
                            }
                        } 
                    },
                };
                return Promise.reject(normalizedError);
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