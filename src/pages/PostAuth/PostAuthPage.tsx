import React from 'react';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { IForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { Form } from '../../forms/Form';
import { Table } from '../../table/Table';
import { Accordion } from './Accordion/Accordion';
import { ITableConfig } from '../../table/type';
import { Details, IDetailsConfig } from '../../detail/Details';
import { v4 as uuidv4 } from 'uuid';

export type IPageType = "list" | "form" | "accordion" | "details" | "dashboard";

export interface IRenderFromPageType extends IPageHeader {
    identifiers ?: any;
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: IForm;
    listPageConfig?: ITableConfig;
    detailsPageConfig?: IDetailsConfig;
    accordionsPageConfig?: Record<string, IRenderFromPageType>;
}

export interface IPostAuthPage extends IRenderFromPageType {
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}

export const PostAuthPage = ({ CustomPageHeader, children, ...props } : IPostAuthPage ) => {
    return <div style={{ paddingTop: "1%"}}>
            <div className = "PostAuthContainer" >
                { CustomPageHeader ? CustomPageHeader : <PageHeader {...props} />}
                <div className="PageContent">
                    { children && children }
                    { !children && <RenderFromPageType {...props} />}
                </div>
            </div>
        </div>
}

export const RenderFromPageType = ( {pageType, cardStyle, accordionsPageConfig, formPageConfig, listPageConfig, detailsPageConfig, identifiers}: IRenderFromPageType ) => {
    
    switch( pageType ) {
        case "list": return <Card style={ cardStyle } > <Table {...listPageConfig} key={`list-${uuidv4()}`} /> </Card>;
        case "form": return <Card style={ cardStyle } > <Form {...formPageConfig} identifiers={identifiers} key={`form-${uuidv4()}`} /> </Card>;
        case "details": return <Card style={ cardStyle } > <Details {...{...detailsPageConfig, identifiers}} key={`details-${uuidv4()}`}/> </Card>;
        case "accordion": return <Accordion accordionsPageConfig={ accordionsPageConfig} />;
        case "dashboard": return <Card style={ cardStyle } >  </Card>;
        default: return <>Invalid Page Type</>;
    }
}