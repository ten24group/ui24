import React, { useState, useEffect } from 'react';
import { Descriptions } from 'antd';
import type { DescriptionsProps } from 'antd';
import { IApiConfig, UI24Config } from '../core';
import { callApiMethod } from '../core';
import { useParams } from "react-router-dom"
import { formatBoolean, formatDate } from '../core/utils';

interface IPropertiesConfig {
    label: string;
    column: string;
    hidden?: boolean;
    initialValue: string;
    fieldType?: string;
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
                    let initialValue = detailResponse[item.column];

                    if([ 'date', 'datetime', 'time' ].includes(item.fieldType?.toLocaleLowerCase())){
                        // formate the date value using uiConfig's date-time-formats
                        initialValue = formatDate(initialValue, item.fieldType?.toLocaleLowerCase() as any);
                    } else if (['boolean', 'switch', 'toggle'].includes(item.fieldType?.toLocaleLowerCase())){
                        // format the boolean value using uiConfig's boolean-formats
                        initialValue = formatBoolean(initialValue);
                    }

                    return {
                        ...item,
                        initialValue
                    }
                }) )
            }
        }

        if( detailApiConfig ) 
            fetchRecordInfo();
    }, [] )

    return <Descriptions title={ pageTitle } items={
        recordInfo
        .filter( item => !item.hidden )
        .map( ( item: IPropertiesConfig, index : number ) => {
        return {
            key: index,
            label: item.label,
            children: item.initialValue
        }
    })} /> 
}
export { Details }