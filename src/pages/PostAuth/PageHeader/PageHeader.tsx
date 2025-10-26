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
    
    /**
     * Renders a single action item (used for both top-level and dropdown items)
     * @param action - The action to render
     * @param key - Unique key for React
     * @param isDropdownItem - Whether this is being rendered inside a dropdown
     * @returns React node or Ant Design menu item object
     */
    const renderSingleAction = (
        action: IPageAction,
        key: string,
        isDropdownItem: boolean = false
    ): React.ReactNode | { key: string; label: React.ReactNode; icon?: React.ReactNode } => {
        // Handle modal actions
        if (action.openInModal && action.modalConfig) {
            const modalTrigger = (
                <OpenInModal
                    key={key}
                    {...action.modalConfig}
                    primaryIndex={routeParams.id}
                    routeParams={routeParams}
                    onSuccessCallback={(response) => {
                        if (action.modalConfig?.submitSuccessRedirect) {
                            const redirectUrl = substituteUrlParams(
                                action.modalConfig.submitSuccessRedirect,
                                routeParams
                            );
                            navigate(redirectUrl);
                        }
                    }}
                >
                    {isDropdownItem ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                            {action.icon && <Icon iconName={action.icon} />}
                            {action.label}
                        </span>
                    ) : (
                        <Button type="primary">{action.label}</Button>
                    )}
                </OpenInModal>
            );
            
            if (isDropdownItem) {
                return {
                    key,
                    label: modalTrigger,
                    icon: action.icon ? <Icon iconName={action.icon} /> : undefined
                };
            }
            return modalTrigger;
        }
        
        // Handle navigation actions
        const url = substituteUrlParams(action.url || '', routeParams);
        
        if (isDropdownItem) {
            return {
                key,
                label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {action.icon && <Icon iconName={action.icon} />}
                        {action.label}
                    </span>
                ),
                icon: action.icon ? <Icon iconName={action.icon} /> : undefined,
                onClick: () => navigate(url)
            };
        }
        
        return (
            <Button
                key={key}
                type="primary"
                onClick={() => navigate(url)}
            >
                {action.label}
            </Button>
        );
    };
    
    /**
     * Renders an action (button or dropdown)
     */
    const renderAction = (item: IPageAction, index: number): React.ReactNode => {
        const actionType = item.type || (item.items && item.items.length > 0 ? 'dropdown' : 'button');
        
        // Handle dropdown with items
        if (actionType === 'dropdown' && item.items && item.items.length > 0) {
            const menuItems = item.items.map((dropItem, dropIndex) => 
                renderSingleAction(
                    dropItem,
                    `${item.label}-${dropIndex}`,
                    true
                )
            );
            
            return (
                <Dropdown 
                    key={`dropdown-${item.label}-${index}`} 
                    menu={{ items: menuItems as any }}
                >
                    <Button>
                        {item.icon && <Icon iconName={item.icon} />}
                        {item.label} <DownOutlined />
                    </Button>
                </Dropdown>
            );
        }
        
        // Handle regular button action
        return renderSingleAction(item, `action-${item.label}-${index}`, false);
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