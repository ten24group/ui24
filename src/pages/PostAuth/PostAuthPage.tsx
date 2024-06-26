import React from 'react';
import { PostAuthLayout } from "../../layout"
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { ICustomForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { PostAuthForm } from '../../forms/PostAuthForm';
import { Table } from '../../table/Table';
import { ITableConfig } from '../../table/type';
import { Details, IDetailsConfig } from '../../detail/Details';
import { v4 as uuidv4 } from 'uuid';

export type IPageType = "list" | "form" | "accordion" | "details" | "dashboard";

interface IRenderFromPageType {
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: ICustomForm;
    listPageConfig?: ITableConfig;
    detailsPageConfig?: IDetailsConfig;
}

export interface IPostAuthPage extends IPageHeader, IRenderFromPageType {
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}

export const PostAuthPage = ({ CustomPageHeader, children, ...props } : IPostAuthPage ) => {
    return <PostAuthLayout>
        <div style={{ paddingTop: "1%"}}>
            <div className = "PostAuthContainer" >
                { CustomPageHeader ? CustomPageHeader : <PageHeader {...props} />}
                <div className="PageContent">
                    { children && children }
                    { !children && <RenderFromPageType {...props} />}
                </div>
            </div>
        </div>
    </PostAuthLayout>;
}

export const RenderFromPageType = ( {pageType, cardStyle, formPageConfig, listPageConfig, detailsPageConfig}: IRenderFromPageType ) => {
    
    switch( pageType ) {
        case "list": return <Card style={ cardStyle } > <Table {...listPageConfig} key={`list-${uuidv4()}`} /> </Card>;
        case "form": return <Card style={ cardStyle } > <PostAuthForm {...formPageConfig} key={`form-${uuidv4()}`} /> </Card>;
        case "details": return <Card style={ cardStyle } > <Details {...detailsPageConfig} key={`details-${uuidv4()}`} /> </Card>;
        case "accordion": return <div> Accordion Page </div>;
        case "dashboard": return <Card style={ cardStyle } >  </Card>;
        default: return <>Invalid Page Type</>;
    }
}