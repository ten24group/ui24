import axios from 'axios';

const axiosInstance = axios.create();

const createAxiosInstance = (baseURL: string) => {
    axiosInstance.defaults.baseURL = baseURL;
};

axiosInstance.interceptors.request.use(
    config => {
      const token = ""; //TODO: replace with Auth logic
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    error => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
    response => {
      if (response.data && response.data.token) {
        //TODO: add set token logic
        //const { setToken } = useAuth();
        //setToken(response.data.token);
      }
      return response;
    },
    error => Promise.reject(error)
);

export { axiosInstance, createAxiosInstance };
