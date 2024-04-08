import { useEffect, useState } from "react"
import { IApiConfig } from "../api/apiMethods";
import { mockApiResponse } from "../mock";
import { convertColumnsConfigForFormField } from "./FormField/FormField";

type PreDefinedPageTypes = "list" | "form";

//currently being used only for pre auth pages - login, forgot-password, reset-password
export const usePageConfig  = <T extends object >( metaDataUrl: string = "") => {
    const [ propertiesConfig, setPropertiesConfig ] = useState([])
    const [ apiConfig, setApiConfig ] = useState<IApiConfig>({})
    const [ pageType, setPageType ] = useState<PreDefinedPageTypes | string>("")

    useEffect( () => {
        const callConfigAPI = async () => {
            //TODO: fetch from core config or API and fallback to mock response
            //use mock response
            const { propertiesConfig: dynamicPropertiesConfig, pageType : dynamicPageType, apiConfig: pageApiConfig }  = mockApiResponse( metaDataUrl );
            setPageType( dynamicPageType )
            setPropertiesConfig( convertColumnsConfigForFormField(dynamicPropertiesConfig) )
            if( pageApiConfig ) {
                setApiConfig( pageApiConfig )
            }
        }

        // callConfigAPI()
        
    }, [] )

    return {
        propertiesConfig,
        pageType,
        apiConfig
    }
}