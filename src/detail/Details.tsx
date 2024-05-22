import React, { useState, useEffect } from 'react';
import { Descriptions } from 'antd';
import type { DescriptionsProps } from 'antd';
import { IApiConfig } from '../core';
import { callApiMethod } from '../core';
import { useParams } from "react-router-dom"

interface IPropertiesConfig {
    label: string;
    column: string;
    initialValue: string;
}

export interface IDetailApiConfig {
    detailApiConfig?: IApiConfig;
}

export interface IDetailsConfig extends IDetailApiConfig {
    pageTitle?: string;
    propertiesConfig: Array<IPropertiesConfig>;
    
}

const Details: React.FC = ({ pageTitle, propertiesConfig, detailApiConfig } : IDetailsConfig ) => {
    const [ recordInfo, setRecordInfo ] = useState<IPropertiesConfig[]>( propertiesConfig )
    const { dynamicID } = useParams()

    useEffect( () => {
        const fetchRecordInfo = async () => {
            const response: any = await callApiMethod( { ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `/${dynamicID}` } );
            if( response.status === 200 ) {
                const detailResponse = response.data[detailApiConfig.responseKey]
                setRecordInfo( recordInfo.map( ( item: IPropertiesConfig ) => {
                    return {
                        ...item,
                        initialValue: detailResponse[item.column]
                    }
                }) )
            }
        }

        if( detailApiConfig ) 
            fetchRecordInfo();
    }, [] )

    return <Descriptions title={ pageTitle } items={recordInfo.map( ( item: IPropertiesConfig, index : number ) => {
        return {
            key: index,
            label: item.label,
            children: item.initialValue
        }
    })} /> 
}
export { Details }