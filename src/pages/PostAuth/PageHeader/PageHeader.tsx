import React from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb, Button } from "antd";
import { IPageAction } from "../../../table/type";
import { Link } from "../../../core/common";
import { OpenInModal } from "../../../modal/Modal";

interface IBreadcrumbs {
    title: string;
    url?: string;
}

type IPageActions = Array<IPageAction> | React.ReactNode;

export interface IPageHeader {
    breadcrumbs?: Array<IBreadcrumbs>;
    pageTitle?: string;
    pageHeaderActions?: IPageActions;
}

export const PageHeader = ({ breadcrumbs = [], pageTitle, pageHeaderActions } : IPageHeader ) => {

    const LocalBreadcrumbs = () => breadcrumbs.length ? <Breadcrumb items={ breadcrumbs.map( ( item ) => {
        return item.url ? <Breadcrumb.Item><Link title={ item.title } url={ item.url } /></Breadcrumb.Item> : <Breadcrumb.Item>{ item.title }</Breadcrumb.Item>
    })} /> : <React.Fragment></React.Fragment>

    const PageActions = Array.isArray(pageHeaderActions) ? <React.Fragment>{ pageHeaderActions.map( (item, index) => {
        return <Button type="primary" key={"actionButton" + index }> 
            { item.openInModal && item.modalConfig ? <OpenInModal {...item.modalConfig} >
                { item.label }
            </OpenInModal>: <Link title={ item.label } url={ item.url } /> }
        </Button>
    }) }</React.Fragment>: pageHeaderActions;

    return <div className="PageHeader">
        <AntPageHeader className="site-page-header" title={ pageTitle } breadcrumb={ LocalBreadcrumbs() } extra = { PageActions } />
    </div>
}