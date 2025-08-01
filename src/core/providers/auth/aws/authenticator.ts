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

    public getApiAuthMode() {
        return this.API_AUTH_MODE;
    };

    public setToken(token: string | null) {
        if (token) {
            this.storage.setItem(AUTH_TOKEN_CACHE_KEY, token);
        } else {
            this.removeToken();
        }
    };

    public getToken() {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.IdToken;
        }
    };

    public getRefreshToken() {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.RefreshToken;
        }
    };

    public isLoggedIn() {
        return !!this.getToken();
    };

    removeToken = () => {
        this.removeCredentials();
        this.storage.removeItem(AUTH_TOKEN_CACHE_KEY);
    };

    public setCredentials = (credentials: AwsCredentialIdentity) => {
        this.storage.setItem(TEMP_AWS_CREDENTIALS_CACHE_KEY, JSON.stringify(credentials));
    };

    public removeCredentials() {
        return this.storage.removeItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);
    };

    /**
     * Retrieve cached AWS credentials from storage.
     * Attempts to parse stored credentials and refresh token on parse failure.
     * Removes stale entries if parsing fails.
     * @returns AwsCredentialIdentity or null if unavailable.
     */
    public async getCachedCredentials(): Promise<AwsCredentialIdentity | null> {

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
    public isValidCredentials(credentials: AwsCredentialIdentity): boolean {
        // if there's no expiration time then it's valid
        if (!credentials.expiration) {
            return true;
        }
        // if the time difference is greater than 0, then the credentials are valid
        const diff = (new Date(credentials.expiration)).getTime() - (Date.now() + 5 * 1000);  // 5 seconds buffer
        return diff > 0;
    };

    /**
     * Request new temporary AWS credentials using current IdToken.
     * Throws error if IdToken is missing or request fails.
     * @returns AxiosResponse with AWS credentials data.
     */
    public async getNewTempAwsCredentials() {
        const token = this.getToken();
        if (!token) {
            console.error('Cannot fetch AWS credentials: no IdToken present');
            throw new Error('Unauthorized: No IdToken available for AWS credentials request');
        }
        try {
            const response = await this.axiosInstance.post(`${this.AWS_TEMP_CREDENTIALS_API_ENDPOINT}/`, { idToken: token });
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
            console.error('Error fetching AWS credentials:', error);
            throw error;
        }
    };

    /**
     * Refresh the Cognito IdToken using the refresh token.
     */
    public async refreshIdToken() {
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
    private async fetchCredentials(): Promise<AwsCredentialIdentity> {

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

    private async fetchCredentialsWithRefresh(): Promise<AwsCredentialIdentity> {
        try {
            return await this.fetchCredentials();
        } catch (error: any) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                // expired IdToken: refresh and retry once
                const refreshResponse = await this.refreshIdToken();
                if (!refreshResponse.data?.IdToken) {
                    this.logout();
                    throw new Error('Unauthorized: Unable to refresh IdToken');
                }
                this.setToken(JSON.stringify(refreshResponse.data));
                return await this.fetchCredentials();
            }
            // other errors: propagate after logout
            this.logout();
            throw error;
        }
    }

    // --- public API ---
    public async getCredentials(): Promise<AwsCredentialIdentity> {
        const cached = await this.getCachedCredentials();
        if (cached) {
            return cached;
        }
        return await this.fetchCredentialsWithRefresh();
    }

    /**
     * Parse and return cached token data.
     * Removes storage entry on invalid JSON or invalid token data.
     * @returns Parsed token object or null.
     */
    public getCachedTokenData(): CachedTokenData | null {
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

            if (!!parsed && !this.isValidTokenData(parsed as CachedTokenData)) {
                this.removeToken();
                return null;
            }

            return parsed as CachedTokenData;
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
    public isValidTokenData(tokenData: CachedTokenData): boolean {
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
            console.warn("Not logged in: can't set auth on request", config);
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
    public async authenticateRequest(config: InternalAxiosRequestConfig<any>): Promise<InternalAxiosRequestConfig<any>> {
        await this.requestHeaders(config);
        return config;
    }

    /**
     * Process tokens/credentials from responses
     */
    public processResponse(response: AxiosResponse<CachedTokenData>): void {
        this.processToken(response);
    }

    /**
     * Should we refresh auth on this error?
     */
    public shouldRefreshAuth(error: AxiosError, _config?: InternalAxiosRequestConfig<any>): boolean {
        return [ 401, 403 ].includes(error.response?.status);
    }

    /**
     * Two-phase refresh: STS-only, then IdToken+STS
     */
    public async refreshAuth(): Promise<void> {
        try {
            // force new credentials (clears cache)
            this.removeCredentials();
            await this.fetchCredentialsWithRefresh();
        } catch (error) {
            console.error('Failed to refresh authentication:', error);
            this.logout();
            throw error;
        }
    }

    /**
     * Logout user
     */
    public logout(): void {
        this.removeCredentials();
        this.removeToken();
    }
}