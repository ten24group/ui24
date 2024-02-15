import { useEffect, useState } from "react"
import { getMethod, postMethod } from "../api/apiMethods"
import { apiResponse } from "../mock";
import { convertColumnsConfigForFormField } from "./formfields/formField";

interface IUseForm {
    metaDataUrl: string;
}

interface IPageConfigResponse {
    status : boolean;
    data: any;
    errors: any;
}
export const usePageConfig  = <T extends object >( metaDataUrl: string = "") => {
    const [ propertiesConfig, setPropertiesConfig ] = useState([])

    useEffect( () => {
        const callConfigAPI = async () => {
            const response = await getMethod<IPageConfigResponse>( metaDataUrl )
            if( response ) {
                //set properties config
            } else {
                const mockResponse = apiResponse( metaDataUrl );
                setPropertiesConfig( convertColumnsConfigForFormField(mockResponse) )
            }
        }

        callConfigAPI()
        
    }, [] )

    return [
        propertiesConfig
    ]
}

//Total possible API calls.
//1. get page config
//2.