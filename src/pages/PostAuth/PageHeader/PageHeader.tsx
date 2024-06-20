import React from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb, Button } from "antd";
import { Link } from "../../../core/common";
import { useNavigate } from 'react-router-dom';

interface IBreadcrumbs {
    title: string;
    url?: string;
}

type IPreDefinedPageActions = "create" | "back";

//type IPageActions = Array<Record<IPreDefinedPageActions, string>> | React.ReactNode;
type IPageAction = {
    url: string;
    label: string;
    htmlType: string;
}
type IPageActions = Array<IPageAction> | React.ReactNode;

export interface IPageHeader {
    breadcrumbs?: Array<IBreadcrumbs>;
    pageTitle: string;
    pageHeaderActions?: IPageActions;
}


export const PageHeader = ({ breadcrumbs = [], pageTitle, pageHeaderActions } : IPageHeader ) => {
    
    const navigate = useNavigate()

    const LocalBreadcrumbs =() => breadcrumbs.length ? <Breadcrumb items={ breadcrumbs.map( ( item ) => {
        return item.url ? <Breadcrumb.Item><Link title={ item.title } url={ item.url } /></Breadcrumb.Item> : <Breadcrumb.Item>{ item.title }</Breadcrumb.Item>
    })} /> : <React.Fragment></React.Fragment>

    const PageActions = Array.isArray(pageHeaderActions) ? <React.Fragment>{ pageHeaderActions.map( (item, index) => {
        return <Button type="primary" key={"actionButton" + index } onClick={ (e) => {
            navigate(item.url)
        }}><Link title={ item.label } url={ item.url } /></Button>
    }) }</React.Fragment>: pageHeaderActions;

    return <div className="PageHeader">
        <AntPageHeader className="site-page-header" title={ pageTitle } breadcrumb={ LocalBreadcrumbs() } extra = { PageActions } />
    </div>
}