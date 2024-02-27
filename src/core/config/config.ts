import { createAxiosInstance } from "../api/config"

interface IFW24Config {
    baseURL: string;
    appLogo: string;
    menuItems?: Array<any>;
    menuApiUrl?: string;
}

const FW24Config = {
    menuApiUrl : ""
} as IFW24Config;

const initFW24Config = ( config : IFW24Config ) => {

    createAxiosInstance(config.baseURL);

    FW24Config.appLogo = config.appLogo;
    
    if( config.menuItems ){
        FW24Config.menuItems = config.menuItems;
    }
    if( config.menuApiUrl ){
        FW24Config.menuApiUrl = config.menuApiUrl;
    }
}

export { FW24Config, initFW24Config }