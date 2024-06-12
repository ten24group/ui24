import React from 'react';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { IForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { Form } from '../../forms/Form';
import { Table } from '../../table/Table';
import { ITableConfig } from '../../table/type';
import { Details, IDetailsConfig } from '../../detail/Details';
import { v4 as uuidv4 } from 'uuid';

type IPageType = "list" | "form" | "accordion" | "details" | "dashboard";

interface IRenderFromPageType {
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: IForm;
    listPageConfig?: ITableConfig;
    detailsPageConfig?: IDetailsConfig;
    //accordion?: Record<string, <ICustomForm | ITableConfig | IDetailsConfig>>
}

export interface IPostAuthPage extends IPageHeader, IRenderFromPageType {
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

export const RenderFromPageType = ( {pageType, cardStyle, formPageConfig, listPageConfig, detailsPageConfig}: IRenderFromPageType ) => {
    
    switch( pageType ) {
        case "list": return <Card style={ cardStyle } > <Table {...listPageConfig} key={`list-${uuidv4()}`} /> </Card>;
        case "form": return <Card style={ cardStyle } > <Form {...formPageConfig} key={`form-${uuidv4()}`} /> </Card>;
        case "details": return <Card style={ cardStyle } > <Details {...detailsPageConfig}  key={`details-${uuidv4()}`}/> </Card>;
        case "accordion": return <div> Accordion Page </div>;
        case "dashboard": return <Card style={ cardStyle } >  </Card>;
        default: return <>Invalid Page Type</>;
    }
}