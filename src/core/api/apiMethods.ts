import { axiosInstance } from './config';

export const getMethod = async <T extends object > (url: string, params = {}) => {
    console.log("API get method");
    try{
        const response = await axiosInstance.get(url, { params });
        return response;
    } catch( error ) {
        console.error("API failed for URL : " + url )
    }
    
}

export const postMethod = async (url: string, data: any) => {
    try {
        const response = await axiosInstance.post(url, data);
        return response.data;
    } catch (error) {
        console.error("API failed for URL : " + url )
    }
};

interface IApiHandler {

}