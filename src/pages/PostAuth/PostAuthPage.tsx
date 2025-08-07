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
import { DashboardPage, IDashboardPageConfig } from './DashboardPage';

export type IPageType = "list" | "form" | "accordion" | "details" | "dashboard" | "custom";

export interface IRenderFromPageType extends IPageHeader {
    identifiers?: string | number;
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: IForm;
    listPageConfig?: ITableConfig;
    detailsPageConfig?: IDetailsConfig;
    accordionsPageConfig?: Record<string, IRenderFromPageType>;
    routeParams?: Record<string, string>;
    dashboardPageConfig?: IDashboardPageConfig;
}

export interface IPostAuthPage extends IRenderFromPageType {
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}

export const PostAuthPage = ({ CustomPageHeader, children, ...props }: IPostAuthPage) => {

    return <div style={{ paddingTop: "1%" }}>
        <div className="PostAuthContainer" >
            {CustomPageHeader ? CustomPageHeader : <PageHeader {...props} />}
            <div className="PageContent">
                {children && children}
                {!children && <RenderFromPageType {...props} />}
            </div>
        </div>
    </div>
}

interface IRenderFromPageTypeProps extends IRenderFromPageType {
  pageType?: IPageType;
  cardStyle?: React.CSSProperties;
  accordionsPageConfig?: Record<string, IRenderFromPageType>;
  formPageConfig?: IForm;
  listPageConfig?: ITableConfig;
  detailsPageConfig?: IDetailsConfig;
  identifiers?: string | number;
  routeParams?: Record<string, string>;
  dashboardPageConfig?: IDashboardPageConfig;
}

export const RenderFromPageType = ({ 
  pageType, 
  cardStyle, 
  accordionsPageConfig, 
  formPageConfig, 
  listPageConfig, 
  detailsPageConfig, 
  identifiers, 
  routeParams, 
  dashboardPageConfig 
}: IRenderFromPageTypeProps) => {

    switch (pageType) {
        case "list": return <Card style={cardStyle} > <Table {...listPageConfig} routeParams={routeParams} key={`list-${uuidv4()}`} /> </Card>;
        case "form": return <Card style={cardStyle} > <Form {...formPageConfig} identifiers={identifiers} routeParams={routeParams} key={`form-${uuidv4()}`} /> </Card>;
        case "details": return <Card style={cardStyle} > <Details {...detailsPageConfig} identifiers={identifiers} routeParams={routeParams} key={`details-${uuidv4()}`} /> </Card>;
        case "accordion": return <Accordion accordionsPageConfig={accordionsPageConfig} routeParams={routeParams} />;
        case "dashboard": return <DashboardPage dashboardConfig={dashboardPageConfig} />;
        case "custom": return <>TODO: handle custom page</>;
        default: return <>Invalid Page Type</>;
    }
}