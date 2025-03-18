import { RequestSigner, SignRequestOptions, useRequestSigner } from "./signer";
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
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
    }
) => {

    const {
        requestSigner = useRequestSigner({}),
        axiosInstance = axios.create({ baseURL: process.env.REACT_APP_API_URL }),
        apiAuthMode = process.env.API_AUTH_MODE?.toUpperCase?.() as API_AUTH_MODE || 'JWT',
        awsTempCredentialsApiEndPoint = process.env.AWS_TEMP_CREDENTIALS_API_ENDPOINT,
    } = options;

    return new Authenticator(
        requestSigner,
        axiosInstance,
        apiAuthMode,
        awsTempCredentialsApiEndPoint
    );
}

const AUTH_TOKEN_CACHE_KEY = "cache_authToken";
const TEMP_AWS_CREDENTIALS_CACHE_KEY = "cache_tmpAwsCredentials";
class Authenticator implements IAuthProvider {


    constructor(
        private readonly awsSigner: RequestSigner,
        private readonly axiosInstance: AxiosInstance,
        private readonly API_AUTH_MODE: API_AUTH_MODE,
        private readonly AWS_TEMP_CREDENTIALS_API_ENDPOINT: string,
    ) { }

    public getApiAuthMode() {
        return this.API_AUTH_MODE;
    };

    public setToken(token: string | null) {
        sessionStorage.setItem(AUTH_TOKEN_CACHE_KEY, token);
    };

    public getToken() {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.IdToken;
        }
        return null;
    };

    public getRefreshToken() {
        const tokenData = this.getCachedTokenData();
        if (tokenData) {
            return tokenData.RefreshToken;
        }
        return null;
    };

    public isLoggedIn() {
        return !!this.getToken();
    };

    removeToken = () => {
        this.removeCredentials();
        sessionStorage.removeItem(AUTH_TOKEN_CACHE_KEY);
    };

    public setCredentials = (credentials: AwsCredentialIdentity) => {
        sessionStorage.setItem(TEMP_AWS_CREDENTIALS_CACHE_KEY, JSON.stringify(credentials));
    };

    public removeCredentials() {
        return sessionStorage.removeItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);
    };

    public getCachedCredentials() {
        const cached = sessionStorage.getItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);

        let parsed = cached ? JSON.parse(cached) : null;

        if (!!parsed && !this.isValidCredentials(parsed)) {
            this.removeCredentials();
            return null;
        }

        return parsed;
    };

    public isValidCredentials(credentials: any) {
        const timeDiff = credentials.expiration
            ? (new Date(credentials.expiration)).getTime() - Date.now()
            : 1; // if there's no expiration time then it's valid
        return timeDiff > 0;
    };

    public async getNewTempAwsCredentials() {
        const response = await this.axiosInstance.post(this.AWS_TEMP_CREDENTIALS_API_ENDPOINT + '/', {
            idToken: this.getToken()
        });

        return response;
    };

    public async getCredentials(): Promise<AwsCredentialIdentity> {

        let credentials = this.getCachedCredentials();

        if (!credentials) {

            const result = await this.getNewTempAwsCredentials();

            credentials = result?.data?.Credentials;

            // format the keys to be compatible with aws-sdk
            // the API returns incompatible keys
            // {"AccessKeyId":"__REDACTED__",
            // "Expiration":"2024-05-07T14:11:53.000Z",
            // "SecretKey":"__REDACTED__",
            // "SessionToken":"__REDACTED__"}
            credentials = {
                accessKeyId: credentials.AccessKeyId,
                secretAccessKey: credentials.SecretKey,
                sessionToken: credentials.SessionToken,
                expiration: credentials.Expiration
            };

            this.setCredentials(credentials);
        }

        return credentials;
    };


    public isValidTokenData(tokenData: any) {
        const timeDiff = tokenData.Expiration
            ? (new Date(tokenData.Expiration)).getTime() - Date.now()
            : 1; // if there's no expiration time then it's valid
        return timeDiff > 0;
    };

    public getCachedTokenData() {
        const tokenData = sessionStorage.getItem(AUTH_TOKEN_CACHE_KEY);

        let parsed = tokenData ? JSON.parse(tokenData) : null;

        if (!!parsed && !this.isValidTokenData(parsed)) {
            this.removeToken();
            return null;
        }

        return parsed;
    }

    processToken = (response: any): boolean => {
        /*
              {
                "AccessToken": "x.x.x-x",
                "ExpiresIn": 3600,
                "IdToken": "x.x.x-x-x",
                "RefreshToken": "x.x.x-x-x",
                "TokenType": "Bearer"
            }
        */
        if (response.data && response.data.IdToken) {

            // verify token and check claims to see is user is authorized for this app
            const decodedToken = jwtDecode(response.data.IdToken);
            // check is cognito:groups includes any of the groups in AUTH_ADMIN_GROUPS  
            const isAuthorized = !decodedToken[ "cognito:groups" ] || (process.env.AUTH_ADMIN_GROUPS && decodedToken[ "cognito:groups" ].some((group: string) => process.env.AUTH_ADMIN_GROUPS.split(',').includes(group)));
            if (!isAuthorized) {
                // not authorized for this app, throw error
                throw new Error('You are not authorized to access this application');
            }

            this.setToken(JSON.stringify(response.data));

            return true
        }
        return false
    }

    requestHeaders = async (config: InternalAxiosRequestConfig<any>) => {
        if (!this.isLoggedIn()) {
            //console.warn("Not logged in: can't set auth on request", config);
            return;
        }

        if (this.getApiAuthMode() === 'JWT') {
            const token = this.getToken();
            if (token) {
                config.headers[ 'Authorization' ] = `Bearer ${token}`;
            }
        } else if (this.getApiAuthMode() === 'AWS_IAM') {

            const requestMethod = config.method.toUpperCase();

            const options: SignRequestOptions = {
                credentials: await this.getCredentials(),
                url: config.url,
                data: null,
                method: requestMethod,
                baseUrl: config.baseURL,
            }

            if ([ 'POST', 'PUT', 'PATCH' ].includes(requestMethod)) {
                options.data = config.data;
            } else if ([ 'GET', 'OPTIONS', 'HEAD', 'DELETE' ].includes(requestMethod)) {
                options.data = config.params;
            }

            const signedHeaders = await this.awsSigner.signedHeaders(options);

            Object.entries(signedHeaders).forEach(([ key, value ]) => {
                config.headers[ key ] = value;
            });
        }
    };
}