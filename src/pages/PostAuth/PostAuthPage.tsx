import React from 'react';
import { PostAuthLayout } from "../../layout"
import { PageHeader, IPageHeader } from './PageHeader/PageHeader';
import { ICustomForm } from '../../core/forms/formConfig';
import "./PostAuthPage.css";
import { Card } from 'antd';
import { PostAuthForm } from '../../forms/PostAuthForm';

type IPageType = "list" | "form" | "accordion"

interface IRenderFromPageType {
    pageType?: IPageType;
    cardStyle?: React.CSSProperties;
    formPageConfig?: ICustomForm;
}

interface IPostAuthPage extends IPageHeader, IRenderFromPageType {
    metaDataUrl: string;
    CustomPageHeader?: React.ReactNode;
    children?: React.ReactNode;
}


export const PostAuthPage = ({ metaDataUrl, CustomPageHeader, children, ...props } : IPostAuthPage ) => {
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

const RenderFromPageType = ( {pageType, cardStyle, formPageConfig}: IRenderFromPageType ) => {
    
    switch( pageType ) {
        case "list": return <Card style={ cardStyle } > List Page </Card>;
        case "form": return <Card style={ cardStyle } > <PostAuthForm {...formPageConfig} /> </Card>;
        case "accordion": return <div> Accordion Page </div>;
        default: return <>Invalid Page Type</>;
    }
}