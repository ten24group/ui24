import { createAxiosInstance } from "../api/config"

interface IFW24Config {
    baseURL: string;
    appLogo: string;
}

const FW24Config = {} as IFW24Config;

const initFW24Config = ( config : IFW24Config ) => {

    createAxiosInstance(config.baseURL);

    FW24Config.appLogo = config.appLogo;
}

export { FW24Config, initFW24Config }