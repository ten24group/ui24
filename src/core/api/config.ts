import axios from 'axios';
import { useAuthenticator } from './authenticator';
import { useState } from 'react';

const defaultAxiosInstance = axios.create();

const createAxiosInstance = (baseURL: string) => {
    defaultAxiosInstance.defaults.baseURL = baseURL;
};

const defaultAuthenticator = useAuthenticator({});

const useAuth = () => {
    const [ isLoggedIn, setIsLoggedIn ] = useState(defaultAuthenticator.isLoggedIn());

    const logOut = () => {
        defaultAuthenticator.logOut();
        setIsLoggedIn(false);
    }

    return {
        isLoggedIn,
        setIsLoggedIn,
        logOut
    };
};

defaultAxiosInstance.interceptors.request.use( async(config) => {
      
        // ** DO NOT override the authorization header set by the signer
        if( !config.headers['authorization'] ){
           await defaultAuthenticator.setAuth(config);
        }
        return config;
    },
    error => Promise.reject(error)
);

defaultAxiosInstance.interceptors.response.use( response => {
      
        if (response.data?.IdToken) {        
            defaultAuthenticator.setToken(response.data.IdToken);
        }

        // TODO: handle 401 and redirect to the login page

        return response;
    },
    error => Promise.reject(error)
);

export { defaultAxiosInstance as axiosInstance, createAxiosInstance , useAuth};
