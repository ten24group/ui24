import React, { useMemo } from "react";
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import "./PageHeader.css";
import { Breadcrumb, Button, Dropdown, MenuProps, Tooltip } from "antd";
import { IPageAction } from "../../../table/type";
import { Link } from "../../../core/common";
import { Icon } from "../../../core/common/Icons/Icons";
import { useNavigate } from "react-router-dom";
import { DownOutlined } from '@ant-design/icons';
import { substituteUrlParams } from "../../../core/utils";
import { renderSingleAction, MenuItem } from "../../../core/utils/actionRenderer";
import { useModalContext } from "../../../core/context";
import { evaluateTemplateValue } from "../../../core/utils/template";
import { Template, EvaluationResult } from "../../../core/types";
import { useEvaluationBatch } from "../../../core/hooks";
import { useDetailRecord } from "../../../core/context/DetailStateContext";
import { useFormRecord } from "../../../core/context/FormStateContext";
import { useSelectedRecords } from "../../../core/context/TableStateContext";
import { useCoreNavigator } from "../../../routes/Navigation";

interface IBreadcrumbs {
    /**
     * Breadcrumb label - can be static string or dynamic template.
     * 
     * @example label: "Teams"
     * @example label: "{teamName}"
     * @example label: { composite: ['teamName', 'city'], template: '{teamName} ({city})' }
     */
    label: Template;
    url?: string;
}

type IPageActions = Array<IPageAction> | React.ReactNode;

export interface IPageHeader {
    breadcrumbs?: Array<IBreadcrumbs>;
    /**
     * Page title - can be static string or dynamic template.
     * Evaluated from routeParams and record data.
     * 
     * @example pageTitle: "Team Detail"
     * @example pageTitle: "{teamName} - Team Detail"
     * @example pageTitle: { composite: ['teamName', 'city'], template: '{teamName} ({city}) - Details' }
     */
    pageTitle?: Template;
    pageHeaderActions?: IPageActions;
    routeParams?: Record<string, string>;
    onRefreshData?: () => void;  // Callback to refresh page data after modal actions
}

export const PageHeader = ({ breadcrumbs = [], pageTitle, pageHeaderActions, routeParams = {}, onRefreshData } : IPageHeader ) => {
    const navigate = useCoreNavigator();
    const { isInModal } = useModalContext();
    
    // Get record data from contexts (use-context-selector only subscribes if context exists)
    const detailRecord = useDetailRecord();
    const formRecord = useFormRecord();
    const selectedRecords = useSelectedRecords();
    
    // Determine which record to use (priority: detail > form > first selected)
    const record = detailRecord || formRecord || (selectedRecords && selectedRecords.length > 0 ? selectedRecords[0] : undefined);
    
    // Build context for template evaluation (merge routeParams with record data)
    // This enables templates like {teamName} to work in page titles and breadcrumbs
    const templateContext = useMemo(() => ({
        ...routeParams,
        ...(record || {})  // Include record data for smart detection templates
    }), [routeParams, record]);
    
    // Evaluate page title template if provided
    const evaluatedPageTitle = pageTitle ? evaluateTemplateValue(pageTitle, templateContext) : undefined;
    
    // Get actions array (handle both array and ReactNode)
    const actionsArray = useMemo(() => 
        Array.isArray(pageHeaderActions) ? pageHeaderActions : [],
        [pageHeaderActions]
    );
    
    /**
     * Evaluate visibility for all actions with record context.
     * 
     * Now automatically includes:
     * - actor (from AppStaticContext)
     * - route, queryParams, modalDepth (from PageStaticContext)
     * - record (from DetailStateContext, FormStateContext, or TableStateContext)
     */
    const evaluations = useEvaluationBatch(
        actionsArray.map(action => action.visibility),
        { record, selectedRecords } // Pass record and selectedRecords for evaluation
    );
    
    // Collect all dropdown items for batch evaluation
    const dropdownItemsMap = useMemo(() => {
        const map = new Map<number, IPageAction[]>();
        actionsArray.forEach((action, index) => {
            const actionType = action.type || (action.items && action.items.length > 0 ? 'dropdown' : 'button');
            if (actionType === 'dropdown' && action.items && action.items.length > 0) {
                map.set(index, action.items);
            }
        });
        return map;
    }, [actionsArray]);
    
    // Flatten all dropdown items for batch evaluation
    const allDropdownItems = useMemo(() => {
        const items: Array<{ actionIndex: number; itemIndex: number; item: IPageAction }> = [];
        dropdownItemsMap.forEach((dropItems, actionIndex) => {
            dropItems.forEach((item, itemIndex) => {
                items.push({ actionIndex, itemIndex, item });
            });
        });
        return items;
    }, [dropdownItemsMap]);
    
    // Evaluate all dropdown items at once (with same context as parent actions)
    const dropdownItemEvaluations = useEvaluationBatch(
        allDropdownItems.map(({ item }) => item.visibility),
        { record, selectedRecords } // Pass same context
    );
    
    // Build a map of dropdown item evaluations for easy lookup
    const dropdownItemEvaluationMap = useMemo(() => {
        const map = new Map<string, EvaluationResult>();
        allDropdownItems.forEach(({ actionIndex, itemIndex }, evalIndex) => {
            map.set(`${actionIndex}-${itemIndex}`, dropdownItemEvaluations[evalIndex]);
        });
        return map;
    }, [allDropdownItems, dropdownItemEvaluations]);
    
    // Filter visible actions and attach evaluation results
    const visibleActions = useMemo(() => 
        actionsArray
            .map((action, index) => ({ action, evaluation: evaluations[index] }))
            .filter(({ evaluation }) => evaluation.visible),
        [actionsArray, evaluations]
    );
    
    /**
     * Renders an action (button or dropdown) with evaluation
     */
    const renderAction = (item: { action: IPageAction; evaluation: EvaluationResult }, actionIndexInVisible: number): React.ReactNode => {
        const { action, evaluation } = item;
        
        // Find the original index of this action in actionsArray
        const originalActionIndex = actionsArray.indexOf(action);
        
        const actionType = action.type || (action.items && action.items.length > 0 ? 'dropdown' : 'button');
        const isDisabled = !evaluation.enabled;
        
        // Handle dropdown with items
        if (actionType === 'dropdown' && action.items && action.items.length > 0) {
            // Filter dropdown items based on visibility evaluation
            const visibleMenuItems: Array<{ dropItem: IPageAction; dropIndex: number; evaluation: EvaluationResult }> = action.items
                .map((dropItem, dropIndex) => {
                    const itemEvaluation = dropdownItemEvaluationMap.get(`${originalActionIndex}-${dropIndex}`);
                    return {
                        dropItem,
                        dropIndex,
                        evaluation: itemEvaluation || { visible: true, enabled: true }
                    };
                })
                .filter(({ evaluation: itemEval }) => itemEval.visible);
            
            // Don't render dropdown if no visible items
            if (visibleMenuItems.length === 0) {
                return null;
            }
            
            // Render visible items as menu items
            const menuItems: MenuProps['items'] = visibleMenuItems.map(({ dropItem, dropIndex, evaluation: itemEval }) => {
                const itemDisabled = !itemEval.enabled;
                
                return renderSingleAction({
                    action: dropItem,
                    key: `${action.label}-${dropIndex}`,
                    isDropdownItem: true,
                    isInModal,
                    isDisabled: itemDisabled,
                    disabledMessage: itemEval.disabledMessage,
                    routeParams,
                    onSuccessCallback: (response) => {
                        // Refresh data if needed
                        if (dropItem.modalConfig?.refreshParentOnSuccess && onRefreshData) {
                            onRefreshData();
                        }
                        
                        if (dropItem.modalConfig?.submitSuccessRedirect) {
                            const redirectUrl = substituteUrlParams(
                                dropItem.modalConfig.submitSuccessRedirect,
                                routeParams
                            );
                            navigate(redirectUrl);
                        }
                    },
                    onNavigate: navigate
                }) as MenuItem;
            });
            
            const dropdownButton = (
                <Button disabled={isDisabled}>
                    {action.icon && <Icon iconName={action.icon} />}
                    {action.label} <DownOutlined />
                </Button>
            );
            
            return (
                <Tooltip 
                    key={`dropdown-${action.label}-${actionIndexInVisible}`}
                    title={isDisabled ? evaluation.disabledMessage : undefined}
                >
                    <Dropdown 
                    menu={{ items: menuItems }}
                        disabled={isDisabled}
                    >
                        {dropdownButton}
                </Dropdown>
                </Tooltip>
            );
        }
        
        // Handle regular button action - create modified action with disabled state
        const modifiedAction = isDisabled ? { ...action, disabled: true } : action;
        
        const buttonAction = renderSingleAction({
            action: modifiedAction,
            key: `action-${action.label}-${actionIndexInVisible}`,
            isDropdownItem: false,
            isInModal,
            isDisabled: isDisabled,
            disabledMessage: evaluation.disabledMessage,
            routeParams,
            onSuccessCallback: (response) => {
                // Refresh data if needed
                if (action.modalConfig?.refreshParentOnSuccess && onRefreshData) {
                    onRefreshData();
                }
                
                if (action.modalConfig?.submitSuccessRedirect) {
                    const redirectUrl = substituteUrlParams(
                        action.modalConfig.submitSuccessRedirect,
                        routeParams
                    );
                    navigate(redirectUrl);
                }
            },
            onNavigate: navigate
        }) as React.ReactNode;
        
        if (isDisabled && evaluation.disabledMessage) {
            return (
                <Tooltip key={`tooltip-${action.label}-${actionIndexInVisible}`} title={evaluation.disabledMessage}>
                    <span>{buttonAction}</span>
                </Tooltip>
            );
        }
        
        return buttonAction;
    };

    // Render actions: use visibleActions if array, otherwise pass through ReactNode
    const PageActions = Array.isArray(pageHeaderActions) 
        ? <React.Fragment>{visibleActions.map(renderAction)}</React.Fragment>
        : pageHeaderActions;

    return (
        <div className="PageHeader">
            <AntPageHeader 
                className="site-page-header" 
                title={evaluatedPageTitle} 
                breadcrumb={{ items: breadcrumbs.map((item, index) => {
                    // Evaluate label template if provided, otherwise use as-is
                    // Use templateContext (includes record data) for smart detection templates
                    const evaluatedLabel = evaluateTemplateValue(item.label, templateContext);
                    
                    // Use substituteUrlParams for consistent placeholder handling
                    const breadcrumbUrl = substituteUrlParams(item.url, templateContext);
                    
                    return {
                        key: `${evaluatedLabel}-${breadcrumbUrl || ''}-${index}`,
                        title: breadcrumbUrl ? (
                            <Link title={evaluatedLabel} url={breadcrumbUrl} />
                        ) : (
                            evaluatedLabel
                        )
                    };
                })}}
                extra={PageActions} 
            />
        </div>
    );
};