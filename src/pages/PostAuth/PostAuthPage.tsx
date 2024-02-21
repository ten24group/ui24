import React from 'react';
import { DashboardLayout } from "../../layout"
import { IFormConfig } from '../../core/forms/formConfig';
import { IFormField } from '../../core';
import { Table } from '../../table/Table';
import { DynamicForm } from '../../forms/PostAuthForm';
import { usePageConfig } from '../../core';
import { Link } from '../../core/common';
import { PageHeader } from '@ant-design/pro-layout';
import { Breadcrumb, Card } from "antd";
import "./PostAuthPage.css";

export const PostAuthPage = ({ metaDataUrl } : { metaDataUrl : string }) => {
    
    const { propertiesConfig, pageType } = usePageConfig( metaDataUrl );

    const breadcrumbs = <Breadcrumb items={[{ title: <Link title="Account List" url={"/account/list"} /> }, { title: "Add New Account"}]} />

    return <>{ propertiesConfig && <DashboardLayout>
        <div style={{ paddingTop: "1%"}}>
            <div className = "PostAuthContainer" >
                <div className="PageHeader">
                    <PageHeader
                    className="site-page-header"
                    title="Accounts"
                    breadcrumb={ breadcrumbs }
                    subTitle="" />
                </div>
                <div className="PageContent">
                    <Card>
                        { pageType==="form" && <DynamicForm formName='addForm' propertiesConfig={ propertiesConfig } />  }
                        { pageType === "list" && <Table propertiesConfig={ propertiesConfig } /> }
                    </Card>
                </div>
            </div>
        </div>
    </DashboardLayout>}</>;
}