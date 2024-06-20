import React, { useState, useEffect } from 'react';
import { Descriptions, DescriptionsProps, List, Spin } from 'antd';
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

    // for list and map fields
    type?: string;
    properties?: Array<IPropertiesConfig>
    items?: {
        type: string,
        properties?: Array<IPropertiesConfig>
    }
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

    const valueFormatter = (item: IPropertiesConfig, itemData: any) => {
        let initialValue = itemData;

        if(item.type === "map"){
            initialValue = item.properties.reduce((acc, prop: IPropertiesConfig) => { 
                acc[prop.column] = valueFormatter(prop, itemData?.[prop.column]);
                return acc;
            }, {});

        } else if(item.type === "list"){
            initialValue = itemData?.map( it => valueFormatter(item.items as any, it) ) ?? [];
        } else if([ 'date', 'datetime', 'time' ].includes(item.fieldType?.toLocaleLowerCase())){
            // formate the date value using uiConfig's date-time-formats
            initialValue = formatDate(initialValue, item.fieldType?.toLocaleLowerCase() as any);
        } else if (['boolean', 'switch', 'toggle'].includes(item.fieldType?.toLocaleLowerCase())){
            // format the boolean value using uiConfig's boolean-formats
            initialValue = formatBoolean(initialValue);
        }

        return initialValue;
    }

    useEffect( () => {
        const fetchRecordInfo = async () => {
            const response: any = await callApiMethod( { ...detailApiConfig, apiUrl: detailApiConfig.apiUrl + `/${dynamicID}` } );
            if( response.status === 200 ) {
                const detailResponse = response.data[detailApiConfig.responseKey]
                
                const formatted = recordInfo.map( item => { 
                    const formatted = valueFormatter(item, detailResponse[item.column]);
                    return { ...item, initialValue: formatted }
                });

                console.log("formatted", formatted)
                setRecordInfo(formatted)
            }
            setDataLoaded(true);
        }

        if( detailApiConfig ) 
            fetchRecordInfo();
    }, [] )

    const makeDescriptionCard = ( options: { name: string, layout: DescriptionsProps['layout'], data: any[] } ) => {
        const { name, data, layout } = options;
        return <>
            <Descriptions 
                title={ name } 
                layout={layout} 
                items={

                data.filter( item => !item.hidden )
                    .map( ( item: IPropertiesConfig, index : number ) => {

                if( ['rich-text', 'wysiwyg'].includes( item.fieldType.toLocaleLowerCase() ) ){
                    return {
                        key: index,
                        label: item.label,
                        children:  <CustomBlockNoteEditor value={item.initialValue as any} readOnly={true} />
                    }
                } 
                
                if ( item.fieldType.toLocaleLowerCase() === 'image' ){
                    return {
                        key: index,
                        label: item.label,
                        children: <img src={item.initialValue} alt={item.label} style={{ width: '100px', height: '100px' }} />
                    }
                } 

                if(item.type === 'list'){

                return {
                    key: index,
                    label: item.label,
                    children: <List
                            itemLayout="horizontal"
                            dataSource={item.initialValue as unknown as any[]}
                            renderItem={(item, index) => (
                                <List.Item>
                                    <pre>
                                        <code>
                                            {JSON.stringify(item, null, 2)}
                                        </code>
                                    </pre>
                                    
                                    {makeDescriptionCard({ name: item.label +" - "+ index, layout: 'vertical', data: item })}
                                </List.Item>
                            )}
                        />

                    }
                }

                return {
                    key: index,
                    label: item.label,
                    children: item.initialValue
                }
                
            })} /> 
        
        </>
    }

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
            
            if ( item.fieldType.toLocaleLowerCase() === 'image' ){

                return {
                    key: index,
                    label: item.label,
                    children: <img src={item.initialValue} alt={item.label} style={{ width: '100px', height: '100px' }} />
                }
            } 

            if(item.type === 'list'){

            return {
                key: index,
                label: item.label,
                children: <List
                        itemLayout="horizontal"
                        dataSource={item.initialValue as unknown as any[]}
                        renderItem={(item, index) => (
                            <List.Item>
                                <pre>
                                    <code>
                                        {JSON.stringify(item, null, 2)}
                                    </code>
                                </pre>
                            </List.Item>
                        )}
                    />

                }

            }

            return {
                key: index,
                label: item.label,
                children: item.initialValue
            }
            
        })} /> 

        {/* {makeDescriptionCard({ name: pageTitle, layout: 'vertical', data: recordInfo })} */}
    </Spin>
    </>
    
}
export { Details }