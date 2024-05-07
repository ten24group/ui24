import axios, { AxiosInstance } from 'axios';
import { AwsCredentialIdentity } from "@smithy/types";

import { convertUTCDateToLocalDate, makeProperUrl } from '../utils';

const axiosInstance = axios.create();

const createAxiosInstance = (baseURL: string) => {
    axiosInstance.defaults.baseURL = baseURL;
};

axiosInstance.interceptors.request.use( config => {
      

      // ** DO NOT override the authorization header set by the signer
      if(!config.headers['authorization']){
        const { getToken } = useAuth();
        
        const token = getToken(); 
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }

      return config;

    },
    // TODO: handle 401 and redirect to the login page
    error => Promise.reject(error)
);

axiosInstance.interceptors.response.use( response => {
      
      if (response.data?.IdToken) {
        
        const { setToken } = useAuth();
        
        setToken(response.data.IdToken);
      }

      return response;
    },
    error => Promise.reject(error)
);

export { axiosInstance, createAxiosInstance };

export const useAuth = () => {
    const AUTH_TOKEN_CACHE_KEY = "cache_authToken";
    const TEMP_AWS_CREDENTIALS_CACHE_KEY = "cache_tmpAwsCredentials";

    const setToken = (token: string) => {
        sessionStorage.setItem(AUTH_TOKEN_CACHE_KEY, token);
    };

    const getToken = () => {
        return sessionStorage.getItem(AUTH_TOKEN_CACHE_KEY);
    };

    const isLoggedIn = () => {
        return !!getToken();
    };

    const removeToken = () => {
        return sessionStorage.removeItem(AUTH_TOKEN_CACHE_KEY);
    };

    const setCredentials = (credentials: AwsCredentialIdentity) => {
        sessionStorage.setItem(TEMP_AWS_CREDENTIALS_CACHE_KEY, JSON.stringify(credentials));
    };

    const removeCredentials = () => {
        return sessionStorage.removeItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);
    };

    const getCachedCredentials = () => {
        const cached = sessionStorage.getItem(TEMP_AWS_CREDENTIALS_CACHE_KEY);

        let parsed = cached ? JSON.parse(cached) : null;

        if( !!parsed && !isValidCredentials(parsed)){
            removeCredentials();
            return null;
        }

        return parsed;
    };

    const isValidCredentials = (credentials: any) => {
        console.log("isValidCredentials credentials", credentials);
        return credentials.expireTime 
        && 
        ( Date.now() < convertUTCDateToLocalDate(new Date(credentials.expireTime)).getTime() );
    };

    const getNewTempAwsCredentials = async () => {
        const url = makeProperUrl(process.env.REACT_APP_API_URL, '/mauth/getCredentials/'); // TODO: make it config driven
        const response = await axiosInstance.post(url, {
            idToken: getToken()
        });

        console.log("getCredentials response", response);
        return response;
    };

    const getCredentials = async (): Promise<AwsCredentialIdentity> => {

        let credentials = getCachedCredentials();

        if (!credentials) {

            const result  = await getNewTempAwsCredentials();
            
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

            setCredentials(credentials);
        }

        return credentials;
    };


    return {
        
        isLoggedIn,

        getToken,
        setToken,
        removeToken,

        getCredentials,
        setCredentials,
        removeCredentials,
    };
}