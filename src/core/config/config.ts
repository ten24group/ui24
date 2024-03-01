import { createAxiosInstance } from "../api/config"
import { IPostAuthPage } from "../../pages/PostAuth/PostAuthPage";

interface IFW24Config {
    baseURL: string;
    appLogo: string;
    menuItems?: Array<any>;
    menuApiUrl?: string;
    pageConfig: Record<string, IPostAuthPage>
}

const FW24Config = {
    menuApiUrl : "",
    pageConfig : {}
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
    if( config.pageConfig ){
        FW24Config.pageConfig = config.pageConfig;
    }
}

export { FW24Config, initFW24Config }