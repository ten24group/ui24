import { createAxiosInstance } from "../api/config"
import { IPostAuthPage } from "../../pages/PostAuth/PostAuthPage";
import { isValidURL, addPathToUrl } from "../utils";

const getConfigUrl = (baseURL: string, endpoint: string): string => {
    return isValidURL(endpoint) ? endpoint : addPathToUrl(baseURL, endpoint);
}

type ConfigResolver<T extends unknown> = T // the config itself
| string  // config url/endpoint
| ( () => Promise<T> ) // a function that resolves the config

interface FormatConfig {
    date?: string;
    time?: string;
    datetime?: string;
    boolean?: {
        true: string; // YES, TRUE, ACTIVE
        false: string; // NO, FALSE, INACTIVE
    }
}

interface IUI24Config {
    baseURL: string;
    appLogo: string;

    uiConfig: {
        auth: ConfigResolver<any>,
        menu: ConfigResolver<any>,
        pages: ConfigResolver<any>;
        dashboard: ConfigResolver<any>;
    }
    
    formateConfig?: FormatConfig 
}


const defaultFormatConfigs: FormatConfig = {
    date: "YYYY-MM-DD",
    time: "HH:mm A",
    datetime: "YYYY-MM-DD HH:mm A",
    boolean: {
        true: "YES",
        false: "NO"
    }
}

const loadConfigsFromUrls = async <T extends any[]>(...urls: string[]): Promise<T>  => {
    const configs = await Promise.all( 
        urls.map( async (url) => { 
            const config = await fetch(url);
            const resolved = await config.json();
            return resolved;
        }) 
    );

    return configs as T;
}

const UI24Config = {
    uiConfig: {},
    formateConfig: defaultFormatConfigs,
} as IUI24Config;

const initUI24Config = async ( config : IUI24Config ) => {

    if(!config.baseURL){
        throw new Error("No baseURL provided in config");
    }

    if(!config.appLogo){
        console.warn("No menu-config provided..");
    }

    // merge the format configs
    UI24Config.formateConfig = { ...defaultFormatConfigs, ...config.formateConfig };

    createAxiosInstance(config.baseURL);

    UI24Config.appLogo = config.appLogo;

    if(config.uiConfig?.menu){

        if(typeof config.uiConfig.menu === "string"){
            
            const [ menuConfig ] = await loadConfigsFromUrls( 
                getConfigUrl(config.baseURL, config.uiConfig.menu) 
            );

            UI24Config.uiConfig.menu = menuConfig;

        } if(typeof config.uiConfig.menu === "function"){

            const menuConfig = await config.uiConfig.menu();
            UI24Config.uiConfig.menu = menuConfig;
        }

    } else {

        console.warn("No menu-config provided..");
    }

    if(config.uiConfig?.auth){

        if(typeof config.uiConfig.auth === "string"){

            const [ authConfig ] = await loadConfigsFromUrls(
                getConfigUrl(config.baseURL, config.uiConfig.auth) 
            );

            UI24Config.uiConfig.auth = authConfig;

        } if(typeof config.uiConfig.auth === "function"){
            const authConfig = await config.uiConfig.auth();
            UI24Config.uiConfig.auth = authConfig;
        }

    } else {

        console.warn("No auth-config provided..");
    }

    if(config.uiConfig?.dashboard){

        if(typeof config.uiConfig.dashboard === "string"){

            const [ authConfig ] = await loadConfigsFromUrls(
                getConfigUrl(config.baseURL, config.uiConfig.dashboard) 
            );

            UI24Config.uiConfig.dashboard = authConfig;

        } if(typeof config.uiConfig.dashboard === "function"){
            const authConfig = await config.uiConfig.dashboard();
            UI24Config.uiConfig.dashboard = authConfig;
        }

    } else {

        console.warn("No dashboard-config provided..");
    }

    if(config.uiConfig?.pages){

        if(typeof config.uiConfig.pages === "string"){

            const [ pagesConfig ] = await loadConfigsFromUrls(
                getConfigUrl(config.baseURL, config.uiConfig.pages)
            );

            UI24Config.uiConfig.pages = pagesConfig;

        } if(typeof config.uiConfig.pages === "function"){

            const pagesConfig = await config.uiConfig.pages();
            UI24Config.uiConfig.pages = pagesConfig;
        }

    } else {
        console.warn("No pages-config provided..");
    }
}

export { UI24Config, initUI24Config }