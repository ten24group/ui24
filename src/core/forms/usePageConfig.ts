import { useEffect, useState } from "react"
import { getMethod, postMethod } from "../api/apiMethods"
import { apiResponse } from "../mock";
import { convertColumnsConfigForFormField } from "./FormField/FormField";

type PreDefinedPageTypes = "list" | "form";

export const usePageConfig  = <T extends object >( metaDataUrl: string = "") => {
    const [ propertiesConfig, setPropertiesConfig ] = useState([])
    const [ pageType, setPageType ] = useState<PreDefinedPageTypes | string>("")

    useEffect( () => {
        const callConfigAPI = async () => {
            const response = await getMethod( metaDataUrl )
            if( response ) {
                //set properties config
            } else {
                const { propertiesConfig: dynamicPropertiesConfig, pageType : dynamicPageType }  = apiResponse( metaDataUrl );
                setPageType( dynamicPageType )
                setPropertiesConfig( convertColumnsConfigForFormField(dynamicPropertiesConfig) )
            }
        }

        callConfigAPI()
        
    }, [] )

    return {
        propertiesConfig,
        pageType
    }
}

//Total possible API calls.
//1. get page config
//2.