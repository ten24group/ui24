import axios from 'axios';
import { useAuth } from './apiMethods';
import { useNavigate } from 'react-router-dom';

const axiosInstance = axios.create();

const createAxiosInstance = (baseURL: string) => {
    axiosInstance.defaults.baseURL = baseURL;
};

axiosInstance.interceptors.request.use(
    config => {
      
      const { getToken } = useAuth();
      
      const token = getToken(); 
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      return config;

    },
    // TODO: handle 401 and redirect to the login page
    error => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    response => {
      
      if (response.data?.IdToken) {
        
        const { setToken } = useAuth();
        
        setToken(response.data.IdToken);
      }

      return response;
    },
    error => Promise.reject(error)
);

export { axiosInstance, createAxiosInstance };

