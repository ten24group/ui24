import React from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb } from "antd";
import { Link } from "../../../core/common";

interface IBreadcrumbs {
    title: string;
    url?: string;
}

export interface IPageHeader {
    breadcrumbs?: Array<IBreadcrumbs>;
    pageTitle: string;
}


export const PageHeader = ({ breadcrumbs = [], pageTitle } : IPageHeader ) => {

    const LocalBreadcrumbs =() => breadcrumbs.length ? <Breadcrumb items={ breadcrumbs.map( ( item ) => {
        return item.url ? <Breadcrumb.Item><Link title={ item.title } url={ item.url } /></Breadcrumb.Item> : <Breadcrumb.Item>{ item.title }</Breadcrumb.Item>
    })} /> : <React.Fragment></React.Fragment>

    return <div className="PageHeader">
        <AntPageHeader className="site-page-header" title={ pageTitle } breadcrumb={ LocalBreadcrumbs() } />
    </div>
}