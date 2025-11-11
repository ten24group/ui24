import { RequestSigner, SignRequestOptions, useRequestSigner } from "./signer";
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { AwsCredentialIdentity } from "@smithy/types";
import { IAuthProvider } from "../interface";
import { jwtDecode } from 'jwt-decode';

type API_AUTH_MODE = 'JWT' | 'AWS_IAM';

export const useAWSAuthenticator = (
    options: {
        apiAuthMode?: API_AUTH_MODE,
        axiosInstance?: AxiosInstance,
        requestSigner?: RequestSigner,
        awsTempCredentialsApiEndPoint?: string,
        refreshTokenApiEndPoint?: string,
        rememberMe?: boolean;
    }
) => {

    const {
        requestSigner = useRequestSigner({}),
        axiosInstance = axios.create({ baseURL: process.env.REACT_APP_API_URL }),
        apiAuthMode = process.env.API_AUTH_MODE?.toUpperCase?.() as API_AUTH_MODE || 'JWT',
        awsTempCredentialsApiEndPoint = process.env.AWS_TEMP_CREDENTIALS_API_ENDPOINT || '/mauth/getCredentials',
        refreshTokenApiEndPoint = process.env.REFRESH_TOKEN_API_ENDPOINT || '/mauth/refreshToken',
        rememberMe = false,
    } = options;

    return new Authenticator(
        requestSigner,
        axiosInstance,
        apiAuthMode,
        awsTempCredentialsApiEndPoint,
        refreshTokenApiEndPoint,
        rememberMe
    );
}

export const AUTH_TOKEN_CACHE_KEY = "ui24_aws_auth_cache_authToken";
export const TEMP_AWS_CREDENTIALS_CACHE_KEY = "ui24_aws_auth_cache_tmpAwsCredentials";

// Token cache data shape stored/retrieved from storage and returned by login/refresh
interface CachedTokenData {
    IdToken: string;
    RefreshToken: string;
    AccessToken: string;
    ExpiresIn: number;
    TokenType: string;
}

// JWT payload shape for Cognito tokens
interface CognitoTokenPayload {
    exp?: number;
    'cognito:groups'?: string[];
}

/**
 * Authenticator handles authentication for JWT and AWS_IAM modes,
 * including token storage, credential caching, and refresh logic.
 */
class Authenticator implements IAuthProvider {

    constructor(
        private readonly awsSigner: RequestSigner,
        private readonly axiosInstance: AxiosInstance,
        private readonly API_AUTH_MODE: API_AUTH_MODE,
        private readonly AWS_TEMP_CREDENTIALS_API_ENDPOINT: string,
        private readonly REFRESH_TOKEN_API_ENDPOINT: string,
        private readonly rememberMe: boolean = false,
    ) { }

    private get storage(): Storage {
        return this.rememberMe ? window.localStorage : window.sessionStorage;
    }

    public getApiAuthMode = () => {
        return this.API_AUTH_MODE;
    };

    public setToken = (token: string | null) => {
        if (token) {
            this.storage.setItem(AUTH_TOKEN_CACHE_KEY, token);
        } else {
            this.removeToken();
        }
    };

    public getToken = () => {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.IdToken;
        }
    };

    public getRefreshToken = () => {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.RefreshToken;
        }
    };

    public isLoggedIn = () => {
        return !!this.getToken();
    };

    public removeToken = () => {
        this.removeCredentials();
        this.storage.removeItem(AUTH_TOKEN_CACHE_KEY);
    };

    public setCredentials = (credentials: AwsCredentialIdentity) => {
        this.storage.setItem(TEMP_AWS_CREDENTIALS_CACHE_KEY, JSON.stringify(credentials));
    };

    public removeCredentials = () => {
        return this.storage.removeItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);
    };

    /**
     * Retrieve cached AWS credentials from storage.
     * Attempts to parse stored credentials and refresh token on parse failure.
     * Removes stale entries if parsing fails.
     * @returns AwsCredentialIdentity or null if unavailable.
     */
    public getCachedCredentials = async (): Promise<AwsCredentialIdentity | null> => {

        // get cached credentials from storage
        const cached = this.storage.getItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);
        if (!cached) {
            return null;
        }

        try {
            // parse cached credentials
            const creds = JSON.parse(cached) as AwsCredentialIdentity;

            // validate credentials
            if (!this.isValidCredentials(creds)) {
                this.removeCredentials();
                return null;
            }

            // return valid credentials
            return creds;

        } catch (error) {
            // remove invalid credentials
            console.error('Failed to parse cached credentials:', error);
            this.removeCredentials();
        }
        return null;
    }

    /**
     * Check whether given AWS temporary credentials are still valid.
     * Uses a 5 seconds buffer time for expiration validation.
     * @param credentials - parsed credentials from storage
     */
    public isValidCredentials = (credentials: AwsCredentialIdentity): boolean => {
        // if there's no expiration time then it's valid
        if (!credentials.expiration) {
            return true;
        }
        // if the time difference is greater than 0, then the credentials are valid
        const expirationTime = new Date(credentials.expiration).getTime();
        const currentTimeWithBuffer = Date.now() + 5 * 1000;  // 5 seconds buffer
        const diff = expirationTime - currentTimeWithBuffer;
        const isValid = diff > 0;
        
        if (!isValid) {
            const expiresIn = Math.floor((expirationTime - Date.now()) / 1000);
            console.log(`[Auth] AWS temporary credentials expired or expiring soon (${expiresIn}s remaining)`);
        }
        
        return isValid;
    };

    /**
     * Request new temporary AWS credentials using current IdToken.
     * Assumes IdToken has already been validated/refreshed by caller (fetchCredentialsWithRefresh).
     * Throws error if IdToken is missing or request fails.
     * @returns AxiosResponse with AWS credentials data.
     */
    public getNewTempAwsCredentials = async () => {
        const tokenData = this.getCachedTokenData();
        if (!tokenData || !tokenData.IdToken) {
            console.error('[Auth] Cannot fetch AWS credentials: no token data or IdToken present');
            throw new Error('Unauthorized: No IdToken available for AWS credentials request');
        }
        
        try {
            const response = await this.axiosInstance.post(`${this.AWS_TEMP_CREDENTIALS_API_ENDPOINT}/`, { idToken: tokenData.IdToken });
            return response as AxiosResponse<{
                Credentials: {
                    AccessKeyId: string;
                    SecretKey: string;
                    SecretAccessKey: string;
                    SessionToken: string;
                    Expiration: string;
                }
            }>;
        } catch (error) {
            console.error('[Auth] Error fetching AWS credentials:', error);
            throw error;
        }
    };

    /**
     * Refresh the Cognito IdToken using the refresh token.
     */
    public refreshIdToken = async () => {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) {
            console.error('Cannot refresh IdToken: no RefreshToken present');
            throw new Error('Unauthorized: No RefreshToken available for IdToken refresh');
        }
        console.log('refreshing id token');
        const response = await this.axiosInstance.post(this.REFRESH_TOKEN_API_ENDPOINT + '/', {
            refreshToken: refreshToken
        });

        return response;
    }

    public refreshToken = async (): Promise<string | null> => {
        try {
            const response = await this.refreshIdToken();
            const idToken = response.data?.IdToken;
            if (idToken) {
                this.setToken(JSON.stringify(response.data));

                // If using IAM auth, we must also refresh the temporary credentials
                if (this.getApiAuthMode() === 'AWS_IAM') {
                    console.log("IAM mode detected, refreshing temporary credentials after token refresh.");
                    // Clear old credentials and fetch new ones
                    this.removeCredentials();
                    await this.getCredentials();
                }
            }
            return idToken ?? null;
        } catch (error) {
            console.error('Failed to refresh AWS token:', error);
            this.removeToken();
            return null;
        }
    }

    // --- credential fetching helpers ---
    private fetchCredentials = async (): Promise<AwsCredentialIdentity> => {

        const response = await this.getNewTempAwsCredentials();
        if (!response.data?.Credentials) {
            throw new Error('Unauthorized: No credentials returned from AWS credentials endpoint');
        }

        const { AccessKeyId, SecretKey, SecretAccessKey, SessionToken, Expiration } = response.data.Credentials;

        const creds: AwsCredentialIdentity = {
            accessKeyId: AccessKeyId,
            secretAccessKey: SecretKey ?? SecretAccessKey ?? '',
            sessionToken: SessionToken,
            expiration: new Date(Expiration),
        };

        this.setCredentials(creds);

        return creds;
    }

    private fetchCredentialsWithRefresh = async (): Promise<AwsCredentialIdentity> => {
        // PROACTIVE CHECK: Check if IdToken is expired BEFORE making request
        const tokenData = this.getCachedTokenData();
        if (tokenData && !this.isValidTokenData(tokenData)) {
            console.log('[Auth] IdToken is expired locally, proactively refreshing before fetching credentials');
            try {
                const refreshResponse = await this.refreshIdToken();
                if (!refreshResponse.data?.IdToken) {
                    console.error('[Auth] No IdToken in refresh response, all tokens exhausted - logging out');
                    this.logout();
                    throw new Error('Unauthorized: Unable to refresh IdToken - all tokens exhausted');
                }
                console.log('[Auth] Successfully refreshed IdToken proactively');
                this.setToken(JSON.stringify(refreshResponse.data));
            } catch (refreshError: any) {
                console.error('[Auth] Failed to proactively refresh IdToken:', refreshError.response?.status || refreshError.message);
                if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
                    console.error('[Auth] RefreshToken expired or invalid - all authentication options exhausted, logging out');
                } else {
                    console.error('[Auth] Unexpected error during token refresh, logging out');
                }
                this.logout();
                throw new Error('Unauthorized: Failed to refresh authentication - refresh token invalid or expired');
            }
        }

        try {
            console.log('[Auth] Fetching AWS temporary credentials with current IdToken');
            return await this.fetchCredentials();
        } catch (error: any) {
            // REACTIVE CHECK: Server rejected (401/403/500 with token expired message)
            const isAuthError = error.response?.status === 401 || 
                               error.response?.status === 403 ||
                               (error.response?.status === 500 && error.response?.data?.message?.includes('Token expired'));
            
            if (isAuthError) {
                console.log('[Auth] Server rejected credentials, attempting to refresh IdToken using RefreshToken...');
                try {
                    const refreshResponse = await this.refreshIdToken();
                    if (!refreshResponse.data?.IdToken) {
                        console.error('[Auth] No IdToken in refresh response, all tokens exhausted - logging out');
                        this.logout();
                        throw new Error('Unauthorized: Unable to refresh IdToken - all tokens exhausted');
                    }
                    console.log('[Auth] Successfully refreshed IdToken, fetching new AWS temporary credentials');
                    this.setToken(JSON.stringify(refreshResponse.data));
                    return await this.fetchCredentials();
                } catch (refreshError: any) {
                    console.error('[Auth] Failed to refresh IdToken:', refreshError.response?.status || refreshError.message);
                    if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
                        console.error('[Auth] RefreshToken expired or invalid - all authentication options exhausted, logging out');
                    } else {
                        console.error('[Auth] Unexpected error during token refresh, logging out');
                    }
                    this.logout();
                    throw new Error('Unauthorized: Failed to refresh authentication - refresh token invalid or expired');
                }
            }
            // Other errors (network, server, etc.): only log, don't logout (may be transient)
            console.error('[Auth] Unexpected error fetching credentials:', error.response?.status || error.message);
            console.error('[Auth] This may be a transient error - not logging out automatically');
            throw error;
        }
    }

    // --- public API ---
    public getCredentials = async (): Promise<AwsCredentialIdentity> => {
        const cached = await this.getCachedCredentials();
        if (cached) {
            console.log('[Auth] Using cached AWS temporary credentials');
            return cached;
        }
        console.log('[Auth] No valid cached credentials, fetching new ones');
        return await this.fetchCredentialsWithRefresh();
    }

    /**
     * Parse and return cached token data.
     * Removes storage entry on invalid JSON but preserves expired tokens (they can be refreshed).
     * @returns Parsed token object or null.
     */
    public getCachedTokenData = (): CachedTokenData | null => {
        try {
            const tokenData = this.storage.getItem(AUTH_TOKEN_CACHE_KEY);
            if (!tokenData) return null;

            let parsed = null;
            try {
                parsed = JSON.parse(tokenData);
            } catch (e) {
                console.error('Failed to parse cached token data:', e);
                this.removeToken();
                return null;
            }

            // CRITICAL FIX: Don't remove expired tokens - they contain RefreshToken needed for renewal
            // Only validate structure, not expiration. Let the refresh flow handle expired IdTokens.
            if (!!parsed && typeof parsed.IdToken === 'string' && typeof parsed.RefreshToken === 'string') {
                return parsed as CachedTokenData;
            }

            // Only remove if token structure is invalid (missing required fields)
            console.warn('[Auth] Token data missing required fields (IdToken or RefreshToken), removing from storage');
            this.removeToken();
            return null;
        } catch (e) {
            console.error('Error accessing token data:', e);
            return null;
        }
    }

    /**
     * Check whether given token data is still valid, with a 5 seconds buffer;
     * this will provide a buffer time for the request to reach server side before the token expires.
     * @param tokenData - parsed token data from storage
     */
    public isValidTokenData = (tokenData: CachedTokenData): boolean => {
        try {
            if (typeof tokenData.IdToken === 'string') {
                const decoded = jwtDecode<CognitoTokenPayload>(tokenData.IdToken);
                if (decoded.exp !== undefined && typeof decoded.exp === 'number') {
                    // test with a 5 seconds buffer time
                    return decoded.exp * 1000 > Date.now() + 5 * 1000;
                }
            }
        } catch (err) {
            console.error('Failed to decode token for validity check:', err);
            return false;
        }
        return true;
    }

    /**
     * Extract and validate token data from API response. 
     * @param response - Axios response containing token data.
     * @returns true if token processed, false otherwise.
     * @throws error if the token user is not authorized for the application.
     */
    processToken = (response: AxiosResponse<CachedTokenData>): boolean => {
        /*
             {
               "AccessToken": "x.x.x-x",
               "ExpiresIn": 3600,
               "IdToken": "x.x.x-x-x",
               "RefreshToken": "x.x.x-x-x",
               "TokenType": "Bearer"
           }
       */
        const { IdToken } = response.data ?? {};
        if (!IdToken) {
            // No token in this response, skip processing
            return false;
        }

        // decode JWT and validate groups
        const decoded = jwtDecode<CognitoTokenPayload>(IdToken);
        const groups = decoded[ 'cognito:groups' ];
        const allowedGroups = process.env.AUTH_ADMIN_GROUPS?.split(',') || [];
        const isAuthorized = !groups || groups.some(g => allowedGroups.includes(g));
        if (!isAuthorized) {
            throw new Error('You are not authorized to access this application');
        }

        // store updated token data
        this.setToken(JSON.stringify(response.data));

        return true;
    }

    /**
     * Asynchronously attach authentication headers to outgoing requests.
     * 
     * If the user is not logged in, it will not set any authentication headers.
     * 
     * If the user is logged in, it will fetch and set appropriate authentication headers; 
     * and will refresh token and fetch required credentials as needed.
     * 
     * @param config - Axios request config.
     */
    public requestHeaders = async (config: InternalAxiosRequestConfig): Promise<void> => {

        if (!this.isLoggedIn()) {
            console.warn("[Auth] Not logged in: can't set auth on request", config.url);
            return;
        }

        // Skip authentication for auth endpoints to prevent circular dependencies
        // These endpoints expect IdToken in the request body, not in headers
        const url = config.url || '';
        const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
        const isAuthEndpoint = fullUrl.includes(this.AWS_TEMP_CREDENTIALS_API_ENDPOINT) || 
                               fullUrl.includes(this.REFRESH_TOKEN_API_ENDPOINT);
        
        if (isAuthEndpoint) {
            console.log(`[Auth] Skipping AWS IAM auth for auth endpoint: ${url}`);
            return;
        }

        if (this.getApiAuthMode() === 'JWT') {
            const token = this.getToken();
            if (!token) {
                const error = new Error("No token returned from getToken; this is unexpected");
                console.error(error);
                throw error;
            }
            config.headers[ 'Authorization' ] = `Bearer ${token}`;

            return;
        }

        if (this.getApiAuthMode() === 'AWS_IAM') {

            const credentials = await this.getCredentials();
            if (!credentials) {
                const error = new Error("No credentials returned from getCredentials; this is unexpected");
                console.error(error);
                throw error;
            }

            const requestMethod = config.method.toUpperCase();
            const options: SignRequestOptions = {
                credentials: credentials,
                url: config.url,
                data: null,
                method: requestMethod,
                baseUrl: config.baseURL,
            }

            if ([ 'POST', 'PUT', 'PATCH' ].includes(requestMethod)) {
                options.data = config.data;
            }
            // ([ 'GET', 'OPTIONS', 'HEAD', 'DELETE' ].includes(requestMethod)
            else {
                options.data = config.params;
            }

            const signedHeaders = await this.awsSigner.signedHeaders(options);

            Object.entries(signedHeaders).forEach(([ key, value ]) => {
                config.headers[ key ] = value;
            });
        }
    };


    /**
     * Attach authentication headers to outgoing requests
     */
    public authenticateRequest = async (config: InternalAxiosRequestConfig<any>): Promise<InternalAxiosRequestConfig<any>> => {
        await this.requestHeaders(config);
        return config;
    }

    /**
     * Process tokens/credentials from responses
     */
    public processResponse = (response: AxiosResponse<CachedTokenData>): void => {
        this.processToken(response);
    }

    /**
     * Should we refresh auth on this error?
     */
    public shouldRefreshAuth = (error: AxiosError, _config?: InternalAxiosRequestConfig<any>): boolean => {
        return [ 401, 403 ].includes(error.response?.status);
    }

    /**
     * Refresh authentication by fetching new temporary credentials.
     * First tries with current IdToken, then refreshes IdToken if needed.
     */
    public refreshAuth = async (): Promise<void> => {
        try {
            console.log('[Auth] refreshAuth called - clearing cached credentials');
            // force new credentials (clears cache)
            this.removeCredentials();
            await this.fetchCredentialsWithRefresh();
            console.log('[Auth] refreshAuth completed successfully');
        } catch (error) {
            console.error('[Auth] refreshAuth failed:', error);
            this.logout();
            throw error;
        }
    }

    /**
     * Logout user
     */
    public logout = (): void => {
        this.removeCredentials();
        this.removeToken();
    }
}