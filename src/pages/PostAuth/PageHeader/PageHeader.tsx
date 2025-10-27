import React from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb, Button, Dropdown, MenuProps } from "antd";
import { IPageAction } from "../../../table/type";
import { Link } from "../../../core/common";
import { Icon } from "../../../core/common/Icons/Icons";
import { useNavigate } from "react-router-dom";
import { DownOutlined } from '@ant-design/icons';
import { substituteUrlParams } from "../../../core/utils";
import { renderSingleAction, MenuItem } from "../../../core/utils/actionRenderer";
import { useModalContext } from "../../../core/context";

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
    const { isInModal } = useModalContext();
    
    /**
     * Renders an action (button or dropdown)
     */
    const renderAction = (item: IPageAction, index: number): React.ReactNode => {
        const actionType = item.type || (item.items && item.items.length > 0 ? 'dropdown' : 'button');
        
        // Handle dropdown with items
        if (actionType === 'dropdown' && item.items && item.items.length > 0) {
            const menuItems: MenuProps['items'] = item.items.map((dropItem, dropIndex) => 
                renderSingleAction({
                    action: dropItem,
                    key: `${item.label}-${dropIndex}`,
                    isDropdownItem: true,
                    isInModal,
                    routeParams,
                    onSuccessCallback: (response) => {
                        if (dropItem.modalConfig?.submitSuccessRedirect) {
                            const redirectUrl = substituteUrlParams(
                                dropItem.modalConfig.submitSuccessRedirect,
                                routeParams
                            );
                            navigate(redirectUrl);
                        }
                    },
                    onNavigate: navigate
                }) as MenuItem
            );
            
            return (
                <Dropdown 
                    key={`dropdown-${item.label}-${index}`} 
                    menu={{ items: menuItems }}
                >
                    <Button>
                        {item.icon && <Icon iconName={item.icon} />}
                        {item.label} <DownOutlined />
                    </Button>
                </Dropdown>
            );
        }
        
        // Handle regular button action
        return renderSingleAction({
            action: item,
            key: `action-${item.label}-${index}`,
            isDropdownItem: false,
            isInModal,
            routeParams,
            onSuccessCallback: (response) => {
                if (item.modalConfig?.submitSuccessRedirect) {
                    const redirectUrl = substituteUrlParams(
                        item.modalConfig.submitSuccessRedirect,
                        routeParams
                    );
                    navigate(redirectUrl);
                }
            },
            onNavigate: navigate
        }) as React.ReactNode;
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