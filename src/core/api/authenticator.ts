import { RequestSigner, SignRequestOptions, useRequestSigner } from "./signer";
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { AwsCredentialIdentity } from "@smithy/types";
import { makeProperUrl } from "../utils";

type API_AUTH_MODE = 'JWT' | 'AWS_IAM';

export const useAuthenticator = (
    options: {
        apiAuthMode?: API_AUTH_MODE ,
        axiosInstance?: AxiosInstance, 
        requestSigner?: RequestSigner,
        awsTempCredentialsApiEndPoint?: string,
    }
) =>  {

    const { 
        requestSigner = useRequestSigner({}), 
        axiosInstance = axios.create({ baseURL: process.env.REACT_APP_API_URL }),
        apiAuthMode = process.env.API_AUTH_MODE?.toUpperCase?.() as API_AUTH_MODE || 'JWT',
        awsTempCredentialsApiEndPoint = process.env.AWS_TEMP_CREDENTIALS_API_ENDPOINT,
    } = options;
    
    const authenticator = new Authenticator(
        requestSigner, 
        axiosInstance,
        apiAuthMode,
        awsTempCredentialsApiEndPoint
    );

    return authenticator;
}

export class Authenticator {

    private readonly AUTH_TOKEN_CACHE_KEY = "cache_authToken";
    private readonly TEMP_AWS_CREDENTIALS_CACHE_KEY = "cache_tmpAwsCredentials";

    constructor(
        private readonly awsSigner: RequestSigner,
        private readonly axiosInstance: AxiosInstance,
        private readonly API_AUTH_MODE: API_AUTH_MODE,
        private readonly AWS_TEMP_CREDENTIALS_API_ENDPOINT: string,
    ){}

    public getApiAuthMode(){
        return this.API_AUTH_MODE;
    };

    public setToken(token: string){
        sessionStorage.setItem(this.AUTH_TOKEN_CACHE_KEY, token);
    };

    public getToken(){
        return sessionStorage.getItem(this.AUTH_TOKEN_CACHE_KEY);
    };

    public isLoggedIn(){
        return !!this.getToken();
    };

    public removeToken(){
        return sessionStorage.removeItem(this.AUTH_TOKEN_CACHE_KEY);
    };

    public setCredentials = (credentials: AwsCredentialIdentity) => {
        sessionStorage.setItem(this.TEMP_AWS_CREDENTIALS_CACHE_KEY, JSON.stringify(credentials));
    };

    public removeCredentials(){
        return sessionStorage.removeItem(this.TEMP_AWS_CREDENTIALS_CACHE_KEY);
    };

    public getCachedCredentials(){
        const cached = sessionStorage.getItem(this.TEMP_AWS_CREDENTIALS_CACHE_KEY);

        let parsed = cached ? JSON.parse(cached) : null;

        if( !!parsed && !this.isValidCredentials(parsed)){
            this.removeCredentials();
            return null;
        }

        return parsed;
    };

    public isValidCredentials(credentials: any){
        const timeDiff = credentials.expiration 
                        ? (new Date(credentials.expiration)).getTime() - Date.now()
                        : 1; // if there's no expiration time then it's valid
        return timeDiff > 0;
    };

    public async getNewTempAwsCredentials(){
        const response = await this.axiosInstance.post(this.AWS_TEMP_CREDENTIALS_API_ENDPOINT+'/', {
            idToken: this.getToken()
        });

        return response;
    };

    public async getCredentials(): Promise<AwsCredentialIdentity> {

        let credentials = this.getCachedCredentials();

        if (!credentials) {

            const result  = await this.getNewTempAwsCredentials();
            
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

    public async setAuth(config: InternalAxiosRequestConfig<any>){

        if(!this.isLoggedIn()){
            console.warn("Not logged in: can't set auth on request", config);
            return;
        }

        if(this.getApiAuthMode() === 'JWT'){
            const token = this.getToken(); 
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        } else if(this.getApiAuthMode() === 'AWS_IAM'){

            const requestMethod = config.method.toUpperCase();

            const options: SignRequestOptions = {
                credentials: await this.getCredentials(),
                url: config.url,
                data: null,
                method: requestMethod,
                baseUrl: config.baseURL,
            }

            if( ['POST', 'PUT', 'PATCH'].includes(requestMethod) ){
                options.data = config.data;
            } else if( ['GET', 'OPTIONS', 'HEAD', 'DELETE'].includes(requestMethod) ){
                options.data = config.params;
            }

            const signedHeaders = await this.awsSigner.signedHeaders(options);

            Object.entries(signedHeaders).forEach(([key, value]) => {
                config.headers[key] = value;
            });
        }

        console.log("config with auth ", {config});
    };
}