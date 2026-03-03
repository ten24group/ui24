import { DownOutlined, EllipsisOutlined } from '@ant-design/icons';
import { PageHeader as AntPageHeader } from '@ant-design/pro-layout';
import { Button, Dropdown, MenuProps, Tooltip } from "antd";
import React, { useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "../../../core/common";
import { Icon } from "../../../core/common/Icons/Icons";
import { useModalContext } from "../../../core/context";
import { useDetailRecord } from "../../../core/context/DetailStateContext";
import { useFormRecord } from "../../../core/context/FormStateContext";
import { useSelectedRecords } from "../../../core/context/TableStateContext";
import { Template } from "../../../core/types";
import type { Condition } from "../../../core/types/evaluation";
import { useEvaluatedItems } from "../../../core/hooks/useEvaluatedItems";
import { substituteUrlParams } from "../../../core/utils";
import { MenuItem, renderSingleAction } from "../../../core/utils/actionRenderer";
import { evaluateTemplateValue } from "../../../core/utils/template";
import { useCoreNavigator } from "../../../routes/Navigation";
import { IPageAction } from "../../../table/type";
import "./PageHeader.css";

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
    /** Visibility condition — when false, the breadcrumb item is hidden. */
    visibility?: Condition;
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
    appendActions?: React.ReactNode;  // Additional actions to append after main actions
    routeParams?: Record<string, any>;
    onRefreshData?: () => void;  // Callback to refresh page data after modal actions
}

export const PageHeader = ({ breadcrumbs = [], pageTitle, pageHeaderActions, appendActions, routeParams = {}, onRefreshData }: IPageHeader) => {
    const navigate = useCoreNavigator();
    const { isInModal } = useModalContext();

    // Get record data from contexts (use-context-selector only subscribes if context exists)
    const detailRecord = useDetailRecord();
    const formRecord = useFormRecord();
    const selectedRecords = useSelectedRecords();

    // Determine which record to use (priority: detail > form > first selected)
    const record = detailRecord || formRecord || (selectedRecords && selectedRecords.length > 0 ? selectedRecords[ 0 ] : undefined);

    // Build context for template evaluation (merge routeParams with record data)
    // This enables templates like {teamName} to work in page titles and breadcrumbs
    const templateContext = useMemo(() => ({
        ...routeParams,
        ...(record || {})  // Include record data for smart detection templates
    }), [ routeParams, record ]);

    // Evaluate page title template if provided
    const evaluatedPageTitle = pageTitle ? evaluateTemplateValue(pageTitle, templateContext) : undefined;

    // Evaluate breadcrumb visibility
    const { visibleItems: visibleBreadcrumbs } = useEvaluatedItems(breadcrumbs);

    // Get actions array (handle both array and ReactNode)
    const actionsArray = useMemo(() =>
        Array.isArray(pageHeaderActions) ? pageHeaderActions : [],
        [ pageHeaderActions ]
    );

    // Evaluate visibility and enablement for all actions
    const actionExtraCtx = useMemo(() => ({ record, selectedRecords }), [ record, selectedRecords ]);
    const { visibilityResults, enablementResults, getItemProps: getActionProps } =
        useEvaluatedItems(actionsArray, { additionalContext: actionExtraCtx });

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
    }, [ actionsArray ]);

    // Flatten all dropdown items for batch evaluation
    const allDropdownItems = useMemo(() => {
        const items: Array<{ actionIndex: number; itemIndex: number; item: IPageAction }> = [];
        dropdownItemsMap.forEach((dropItems, actionIndex) => {
            dropItems.forEach((item, itemIndex) => {
                items.push({ actionIndex, itemIndex, item });
            });
        });
        return items;
    }, [ dropdownItemsMap ]);

    // Evaluate dropdown item visibility + enablement
    const dropdownItemObjects = useMemo(() => allDropdownItems.map(d => d.item), [ allDropdownItems ]);
    const { visibilityResults: ddVisResults, enablementResults: ddEnResults, getItemProps: getDDItemProps } =
        useEvaluatedItems(dropdownItemObjects, { additionalContext: actionExtraCtx });

    // Build a map of dropdown item evaluation results for easy lookup
    const dropdownItemEvaluationMap = useMemo(() => {
        const map = new Map<string, { visible: boolean; enabled: boolean; disabledMessage?: string }>();
        allDropdownItems.forEach(({ actionIndex, itemIndex }, evalIndex) => {
            const props = getDDItemProps(evalIndex);
            map.set(`${actionIndex}-${itemIndex}`, {
                visible: ddVisResults[ evalIndex ],
                enabled: ddEnResults[ evalIndex ],
                disabledMessage: props.conditionDisabledMessage,
            });
        });
        return map;
    }, [ allDropdownItems, ddVisResults, ddEnResults, getDDItemProps ]);

    // Filter visible actions and build evaluation metadata
    const visibleActions = useMemo(() =>
        actionsArray
            .map((action, index) => {
                const props = getActionProps(index);
                return {
                    action,
                    visible: visibilityResults[ index ],
                    enabled: enablementResults[ index ],
                    disabledMessage: props.conditionDisabledMessage,
                };
            })
            .filter(({ visible }) => visible),
        [ actionsArray, visibilityResults, enablementResults, getActionProps ]
    );

    /**
     * Renders an action (button or dropdown) with condition evaluation results
     */
    const renderAction = (
        item: { action: IPageAction; visible: boolean; enabled: boolean; disabledMessage?: string },
        actionIndexInVisible: number
    ): React.ReactNode => {
        const { action, enabled, disabledMessage } = item;

        // Find the original index of this action in actionsArray
        const originalActionIndex = actionsArray.indexOf(action);

        const actionType = action.type || (action.items && action.items.length > 0 ? 'dropdown' : 'button');
        const isDisabled = !enabled;

        // Handle dropdown with items (type: 'dropdown' or 'more')
        if ((actionType === 'dropdown' || actionType === 'more') && action.items && action.items.length > 0) {
            // Filter dropdown items based on visibility condition
            const visibleMenuItems: Array<{ dropItem: IPageAction; dropIndex: number; enabled: boolean; disabledMessage?: string }> = action.items
                .map((dropItem, dropIndex) => {
                    const itemEval = dropdownItemEvaluationMap.get(`${originalActionIndex}-${dropIndex}`);
                    return {
                        dropItem,
                        dropIndex,
                        visible: itemEval?.visible ?? true,
                        enabled: itemEval?.enabled ?? true,
                        disabledMessage: itemEval?.disabledMessage,
                    };
                })
                .filter(({ visible: itemVisible }) => itemVisible);

            // Don't render dropdown if no visible items
            if (visibleMenuItems.length === 0) {
                return null;
            }

            // Render visible items with smart dividers.
            // Add divider before items with different interaction patterns (modal vs nav).
            const menuItems: MenuProps[ 'items' ] = visibleMenuItems.flatMap(({ dropItem, dropIndex, enabled: itemEnabled, disabledMessage: itemDisabledMsg }, idx) => {
                const itemDisabled = !itemEnabled;
                const nestedItems = (dropItem as any).items;
                const hasNested = Array.isArray(nestedItems) && nestedItems.length > 0;

                // Detect if we need a divider before this item
                const prevItem = idx > 0 ? visibleMenuItems[ idx - 1 ]?.dropItem : null;
                const needsDivider = idx > 0 && prevItem && (
                    // Add divider if switching from plain nav to modal/drawer
                    (!prevItem.openInModal && !prevItem.openInDrawer && (dropItem.openInModal || dropItem.openInDrawer)) ||
                    // Or if previous had no icon and this has one
                    (!prevItem.icon && dropItem.icon)
                );

                const result: NonNullable<MenuProps[ 'items' ]> = [];
                if (needsDivider) {
                    result.push({ type: 'divider' as const, key: `divider-${dropIndex}` });
                }

                if (hasNested) {
                    // Submenu item (hover to expand)
                    result.push({
                        key: `${action.label}-${dropIndex}`,
                        label: dropItem.label,
                        icon: dropItem.icon ? <Icon iconName={dropItem.icon} /> : undefined,
                        disabled: itemDisabled,
                        children: nestedItems.map((subItem: IPageAction, subIdx: number) =>
                            renderSingleAction({
                                action: subItem,
                                key: `${dropIndex}-${subIdx}`,
                                isDropdownItem: true,
                                isInModal,
                                routeParams,
                                onSuccessCallback: (response) => {
                                    if (subItem.modalConfig?.refreshParentOnSuccess && onRefreshData) {
                                        onRefreshData();
                                    }
                                },
                                onNavigate: navigate
                            }) as MenuItem
                        )
                    } as MenuItem);
                } else {
                    // Flat item
                    result.push(renderSingleAction({
                        action: dropItem,
                        key: `${action.label}-${dropIndex}`,
                        isDropdownItem: true,
                        isInModal,
                        isDisabled: itemDisabled,
                        disabledMessage: itemDisabledMsg,
                        routeParams,
                        onSuccessCallback: (response) => {
                            if (dropItem.modalConfig?.refreshParentOnSuccess && onRefreshData) {
                                onRefreshData();
                            }
                        },
                        onNavigate: navigate
                    }) as MenuItem);
                }

                return result;
            });

            // 'more' type renders as icon-only ellipsis (secondary actions / autoGroup pattern)
            const dropdownButton = actionType === 'more' || (!action.label && action.icon) ? (
                <Button icon={<EllipsisOutlined />} disabled={isDisabled} title={action.tooltip as string | undefined} />
            ) : (
                <Button disabled={isDisabled}>
                    {action.icon && <Icon iconName={action.icon} />}
                    {action.label} <DownOutlined />
                </Button>
            );

            return (
                <Tooltip
                    key={`dropdown-${action.label}-${actionIndexInVisible}`}
                    title={isDisabled ? disabledMessage : undefined}
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
            disabledMessage,
            routeParams,
            onSuccessCallback: (response) => {
                // Refresh data if needed
                if (action.modalConfig?.refreshParentOnSuccess && onRefreshData) {
                    onRefreshData();
                }
            },
            onNavigate: navigate
        }) as React.ReactNode;

        if (isDisabled && disabledMessage) {
            return (
                <Tooltip key={`tooltip-${action.label}-${actionIndexInVisible}`} title={disabledMessage}>
                    <span>{buttonAction}</span>
                </Tooltip>
            );
        }

        return buttonAction;
    };

    // Render actions: use visibleActions if array, otherwise pass through ReactNode
    const PageActions = Array.isArray(pageHeaderActions)
        ? <React.Fragment>{visibleActions.map(renderAction)}{appendActions}</React.Fragment>
        : (
            <>
                {pageHeaderActions}
                {appendActions}
            </>
        );

    return (
        <>
            {/* Update document title using react-helmet-async */}
            {evaluatedPageTitle && !isInModal && (
                <Helmet>
                    <title>{evaluatedPageTitle}</title>
                </Helmet>
            )}

            <div className="PageHeader">
                <AntPageHeader
                    className="site-page-header"
                    title={evaluatedPageTitle}
                    breadcrumb={{
                        items: visibleBreadcrumbs.map((item, index) => {
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
                        })
                    }}
                    extra={PageActions}
                />
            </div>
        </>
    );
};