import React from 'react';
import { PostAuthLayout } from "../../layout"
//import { DynamicForm } from '../../forms/PostAuthForm';
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import "./PostAuthPage.css";
/**
 * Dynamic Properties
 * 
 * @returns 
 */

interface IPostAuthPage extends IPageHeader{
    metaDataUrl: string;
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}
export const PostAuthPage = ({ metaDataUrl, CustomPageHeader, pageTitle, children } : IPostAuthPage ) => {
    return <PostAuthLayout>
        <div style={{ paddingTop: "1%"}}>
            <div className = "PostAuthContainer" >
                { CustomPageHeader ? CustomPageHeader : <PageHeader pageTitle={ pageTitle } />}
                <div className="PageContent">
                    { children }
                </div>
            </div>
        </div>
    </PostAuthLayout>;
}