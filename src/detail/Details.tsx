import React from 'react';
import { Descriptions } from 'antd';
import type { DescriptionsProps } from 'antd';

interface IPropertiesConfig {
    label: string;
    initialValue: string;
}

export interface IDetailsConfig {
    pageTitle?: string;
    propertiesConfig: Array<IPropertiesConfig>;
}

const Details: React.FC = ({ pageTitle, propertiesConfig } : IDetailsConfig ) => {
    
    return <Descriptions title={ pageTitle } items={propertiesConfig.map( ( item: IPropertiesConfig, index : number ) => {
        return {
            key: index,
            label: item.label,
            children: item.initialValue
        }
    })} /> 
}
export { Details }