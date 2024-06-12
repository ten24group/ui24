import { useEffect, useState } from "react"
import { IApiConfig, useUi24Config } from "../context";
import { mockApiResponse } from "../mock";
import { convertColumnsConfigForFormField } from "./FormField/FormField";

type PreDefinedPageTypes = "list" | "form";

//currently being used only for pre auth pages - login, forgot-password, reset-password
export const usePageConfig  = <T extends object >( metaDataUrl: string = "") => {
    const [ propertiesConfig, setPropertiesConfig ] = useState([])
    const {selectConfig } = useUi24Config()
    const UI24Config = selectConfig( config => config )
    const [ apiConfig, setApiConfig ] = useState<IApiConfig>();
    const [ pageType, setPageType ] = useState<PreDefinedPageTypes | string>("")

    const callConfigAPI = async () => {
        //TODO: fetch from core config or API and fallback to mock response
        //use mock response
        const { propertiesConfig: dynamicPropertiesConfig, pageType : dynamicPageType, apiConfig: pageApiConfig }  = mockApiResponse( metaDataUrl );
        setPageType( dynamicPageType )
        setPropertiesConfig( dynamicPropertiesConfig ) //convertColumnsConfigForFormField(dynamicPropertiesConfig) )
        if( pageApiConfig ) {
            setApiConfig( pageApiConfig )
        }
    }
    
    useEffect( () => {
        
        if( UI24Config.uiConfig.auth && UI24Config.uiConfig.auth[metaDataUrl]){
            const { pageType, propertiesConfig, apiConfig } = UI24Config.uiConfig.auth[metaDataUrl];
            
            setPageType( pageType )
            setPropertiesConfig( propertiesConfig );
            if( apiConfig ) {
                setApiConfig( apiConfig )
            }

        } else {

            callConfigAPI();
        }
        
    }, [] )

    return {
        propertiesConfig,
        pageType,
        apiConfig
    }
}