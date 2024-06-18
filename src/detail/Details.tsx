import React, { useState, useEffect } from 'react';
import { Descriptions, Spin } from 'antd';
import { IApiConfig } from '../core';
import { callApiMethod } from '../core';
import { useParams } from "react-router-dom"
import { formatBoolean, formatDate } from '../core/utils';
import { CustomBlockNoteEditor } from '../core/common';

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
    const [dataLoaded, setDataLoaded] = useState(false);

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
            setDataLoaded(true);
        }

        if( detailApiConfig ) 
            fetchRecordInfo();
    }, [] )

    return <>  
    <Spin spinning={!dataLoaded}>
        <Descriptions title={ pageTitle } layout='vertical' items={
            recordInfo
            .filter( item => !item.hidden )
            .map( ( item: IPropertiesConfig, index : number ) => {

            if( ['rich-text', 'wysiwyg'].includes( item.fieldType.toLocaleLowerCase() ) ){

                return {
                    key: index,
                    label: item.label,
                    children:  <CustomBlockNoteEditor value={item.initialValue as any} readOnly={true} />
                }

            } 
            else if ( item.fieldType.toLocaleLowerCase() === 'image' ){

                return {
                    key: index,
                    label: item.label,
                    children: <img src={item.initialValue} alt={item.label} style={{ width: '100px', height: '100px' }} />
                }
            } 

            return {
                key: index,
                label: item.label,
                children: item.initialValue
            }
            
        })} /> 
    </Spin>
    </>
    
}
export { Details }