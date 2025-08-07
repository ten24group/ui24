import React from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb, Button, Dropdown } from "antd";
import { IPageAction } from "../../../table/type";
import { Link } from "../../../core/common";
import { Icon } from "../../../core/common/Icons/Icons";
import { OpenInModal } from "../../../modal/Modal";
import { useNavigate } from "react-router-dom";
import { DownOutlined } from '@ant-design/icons';
import { substituteUrlParams } from "../../../core/utils";

interface IBreadcrumbs {
    label: string;
    url?: string;
}

type IPageActions = Array<IPageAction> | React.ReactNode;

export interface IPageHeader {
    breadcrumbs?: Array<IBreadcrumbs>;
    pageTitle?: string;
    pageHeaderActions?: IPageActions;
    routeParams?: Record<string, string>;
}

export const PageHeader = ({ breadcrumbs = [], pageTitle, pageHeaderActions, routeParams = {} } : IPageHeader ) => {
    const navigate = useNavigate();
    const [openModalIndex, setOpenModalIndex] = React.useState<number | null>(null);
    
    const renderAction = (item: IPageAction, index: number) => {
        if (item.type === 'dropdown' && item.items) {
            const dropdownItems = item.items.map((dropItem, dropIndex) => {
                let url = dropItem.url;
                // Use substituteUrlParams for consistent placeholder handling
                url = substituteUrlParams(url, routeParams);
                return {
                    key: `${dropItem.label}-${url}-${dropIndex}`,
                    label: (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {dropItem.icon ? <Icon iconName={dropItem.icon} /> : null}
                            {dropItem.label}
                        </span>
                    ),
                    onClick: () => navigate(url)
                };
            });

            return (
                <Dropdown 
                    key={`dropdown-${item.label}-${index}`} 
                    menu={{ items: dropdownItems }}
                >
                    <Button>
                        {item.label} <DownOutlined />
                    </Button>
                </Dropdown>
            );
        }

        let url = item.url || '';
        // Use substituteUrlParams for consistent placeholder handling
        url = substituteUrlParams(url, routeParams);

        if (item.openInModal && item.modalConfig) {
            return (
                <OpenInModal
                    key={`action-${item.label}-${index}`}
                    {...item.modalConfig}
                    primaryIndex={routeParams.id}
                    routeParams={routeParams}
                    onSuccessCallback={(response) => {
                        // Use substituteUrlParams for consistent placeholder handling
                        const redirectUrl = substituteUrlParams(item.modalConfig.submitSuccessRedirect, routeParams);
                        navigate(redirectUrl);
                    }}
                >
                    <Button type="primary">{item.label}</Button>
                </OpenInModal>
            );
        }

        return (
            <Button
                type="primary"
                key={`action-${item.label}-${index}`}
                onClick={() => {
                    if (!item.openInModal) navigate(url);
                }}
            >
                {item.label}
            </Button>
        );
    };

    const PageActions = Array.isArray(pageHeaderActions) 
        ? <React.Fragment>{pageHeaderActions.map(renderAction)}</React.Fragment>
        : pageHeaderActions;

    return (
        <div className="PageHeader">
            <AntPageHeader 
                className="site-page-header" 
                title={pageTitle} 
                breadcrumb={{ items: breadcrumbs.map((item, index) => {
                    // Use substituteUrlParams for consistent placeholder handling
                    const breadcrumbUrl = substituteUrlParams(item.url, routeParams);
                    
                    return {
                        key: `${item.label}-${breadcrumbUrl || ''}-${index}`,
                        title: breadcrumbUrl ? (
                            <Link title={item.label} url={breadcrumbUrl} />
                        ) : (
                            item.label
                        )
                    };
                })}}
                extra={PageActions} 
            />
        </div>
    );
};