import React from "react";
import { Button, MenuProps, Tooltip } from "antd";
import { Icon } from "../common/Icons/Icons";
import { OpenInModal } from "../../modal/Modal";
import { OpenRouteInModal } from "../../modal/OpenRouteInModal";
import { OpenRouteInDrawer } from "../../modal/OpenRouteInDrawer";
import { OpenInDrawer } from "../../modal/Drawer";
import { IPageAction } from "../../table/type";
import { substituteUrlParams, extractUrlParamNames } from "../utils";
import { evaluateTemplateValue } from "../utils/template";
import { isExternalUrl, resolveAnchorProps } from "../utils/link-utils";
import { executeCopyToClipboard } from "../utils/copyUtils";
import { BulkDeleteAction, type BulkDeleteTableContext } from "../bulk-delete/BulkDeleteAction";

/** Row id is only passed to forms when the modal submit URL has `:param` placeholders to fill. */
function rowIdentifiersForSubmitUrl(
  submitApiUrl: string | undefined,
  primaryIndex?: string,
  routeParams?: Record<string, string>,
): string | undefined {
  if (!submitApiUrl || extractUrlParamNames(submitApiUrl).length === 0) {
    return undefined;
  }
  return primaryIndex || routeParams?.id;
}

function getSubmitApiUrl(pageConfig: unknown): string | undefined {
  if (!pageConfig || typeof pageConfig !== 'object' || !('apiConfig' in pageConfig)) {
    return undefined;
  }
  const apiConfig = (pageConfig as { apiConfig?: { apiUrl?: string } }).apiConfig;
  return typeof apiConfig?.apiUrl === 'string' ? apiConfig.apiUrl : undefined;
}

export type MenuItem = Required<MenuProps>[ 'items' ][ number ];

interface RenderActionOptions {
  action: IPageAction;
  key: string;
  isDropdownItem?: boolean;
  isTableRowAction?: boolean;
  isInModal?: boolean;  // NEW: Pass modal context from parent component
  isDisabled?: boolean;
  disabledMessage?: string;
  routeParams?: Record<string, any>;
  primaryIndex?: string;
  record?: Record<string, any>;
  /** Selected records for bulk actions (copy, etc.) */
  selectedRecords?: ReadonlyArray<Record<string, any>>;
  /** Table context (apiConfig, propertiesConfig, ...) forwarded to bulk-delete's delete-by-query mode. */
  tableContext?: BulkDeleteTableContext;
  onSuccessCallback?: (response?: any) => void;
  onNavigate?: (urlOrDelta: string | number) => void;
}

/**
 * Renders a single action (button or dropdown item) with support for modals and navigation
 * Can be used for both page header actions and table row actions
 * 
 * Supports two modal patterns:
 * 1. Inline modal config: { openInModal: true, modalConfig: {...} }
 * 2. Route resolution: { openInModal: true, url: "/view-user/:id" }
 */
export function renderSingleAction(opts: RenderActionOptions & { isDropdownItem: true }): MenuItem | null;
export function renderSingleAction(opts: RenderActionOptions & { isDropdownItem?: false }): React.ReactNode | null;
export function renderSingleAction(opts: RenderActionOptions): React.ReactNode | MenuItem | null;
export function renderSingleAction({
  action,
  key,
  isDropdownItem = false,
  isTableRowAction = false,
  isInModal = false,
  isDisabled = false,
  disabledMessage = '',
  routeParams = {},
  primaryIndex,
  record,
  selectedRecords,
  tableContext,
  onSuccessCallback,
  onNavigate
}: RenderActionOptions): React.ReactNode | MenuItem | null {
  // Check if action should be hidden in modal context
  if (isInModal && action.hideInModal) {
    return null;
  }

  // Evaluate template if provided, otherwise use static label
  // Context: use record for table row actions, routeParams for page actions
  const context = record || routeParams;
  const evaluatedLabel = evaluateTemplateValue(action.template, context, action.label);

  // Evaluate tooltip if provided
  // IMPORTANT: Only show tooltip if explicitly provided or if disabled with message
  // Do NOT use evaluatedLabel as fallback - that would show IDs and other unwanted text
  const evaluatedTooltip = action.tooltip
    ? evaluateTemplateValue(action.tooltip, context)
    : (isDisabled && disabledMessage ? disabledMessage : undefined);

  // Helper to wrap content with Tooltip only if tooltip value exists
  // Wraps content in span to ensure Tooltip has a proper DOM element to attach to
  const wrapWithTooltip = (content: React.ReactNode) => {
    if (!evaluatedTooltip) return content;
    return <Tooltip title={evaluatedTooltip}><span style={{ display: 'inline-block' }}>{content}</span></Tooltip>;
  };

  if (action.bulkDeleteConfig) {
    const trigger = (
      <BulkDeleteAction
        key={key}
        config={action.bulkDeleteConfig}
        label={evaluatedLabel}
        icon={action.icon ? <Icon iconName={action.icon} /> : undefined}
        selectedRecords={selectedRecords}
        routeParams={routeParams}
        tableContext={tableContext}
        disabled={isDisabled}
        onSuccess={onSuccessCallback}
      />
    );

    if (isDropdownItem) {
      return {
        key,
        label: trigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }

    return wrapWithTooltip(trigger);
  }

  const renderPageHeaderButton = (onClick?: () => void) => (
    <Button type="primary" disabled={isDisabled} onClick={onClick}>
      {action.icon && <><Icon iconName={action.icon} />{' '}</>}{evaluatedLabel}
    </Button>
  );

  // Pattern 1: Modal with inline config
  if (action.openInModal && action.modalConfig) {
    // Merge record data with routeParams for template resolution (initialValues)
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;
    const rowIdentifier = rowIdentifiersForSubmitUrl(
      getSubmitApiUrl(action.modalConfig.modalPageConfig),
      primaryIndex,
      routeParams,
    );

    const modalTrigger = (
      <OpenInModal
        key={key}
        {...action.modalConfig}
        modalWidth={action.modalWidth}  // Pass modalWidth from action level
        modalTitle={action.modalTitle}  // Pass modalTitle from action level (if set)
        primaryIndex={primaryIndex || routeParams.id}
        identifiers={rowIdentifier}
        routeParams={finalRouteParams}  // Include record data for template resolution
        onSuccessCallback={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "delete"} />
          ) : (
            renderPageHeaderButton()
          )
        )}
      </OpenInModal>
    );

    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }
    return modalTrigger;
  }

  // Pattern 2: Modal with route resolution (NEW)
  // Supports both URL-based resolution and modalConfigRef
  if (action.openInModal && (action.url || action.modalConfigRef) && !action.modalConfig) {
    // Merge record data with routeParams for template resolution
    // Priority: record data overrides routeParams
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const modalTrigger = (
      <OpenRouteInModal
        key={key}
        url={action.url}
        routeParams={finalRouteParams}
        primaryIndex={primaryIndex}
        modalConfigRef={action.modalConfigRef}
        modalWidth={action.modalWidth}
        modalTitle={action.modalTitle}
        openInModalCondition={action.openInModalCondition}
        onSuccessCallback={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "eye"} />
          ) : (
            renderPageHeaderButton()
          )
        )}
      </OpenRouteInModal>
    );

    if (isDropdownItem) {
      return {
        key,
        label: modalTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }
    return modalTrigger;
  }

  // Pattern 2b: Drawer with inline config
  // Supports inline page config (drawerType + drawerPageConfig)
  if (action.openInDrawer && action.drawerConfig?.drawerType && action.drawerConfig?.drawerPageConfig) {
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;
    const rowIdentifier = rowIdentifiersForSubmitUrl(
      getSubmitApiUrl(action.drawerConfig.drawerPageConfig),
      primaryIndex,
      routeParams,
    );

    const drawerTrigger = (
      <OpenInDrawer
        key={key}
        pageType={action.drawerConfig.drawerType}
        pageConfig={action.drawerConfig.drawerPageConfig}
        responseConfig={action.drawerConfig.responseConfig}
        dynamicConfigKey={action.drawerConfig.dynamicConfigKey}
        title={action.drawerConfig.title}
        placement={action.drawerConfig.placement}
        width={action.drawerConfig.width}
        height={action.drawerConfig.height}
        closable={action.drawerConfig.closable}
        mask={action.drawerConfig.mask}
        maskClosable={action.drawerConfig.maskClosable}
        destroyOnClose={action.drawerConfig.destroyOnClose}
        routeParams={finalRouteParams}
        identifiers={rowIdentifier}
        onSuccess={onSuccessCallback}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "edit"} />
          ) : (
            renderPageHeaderButton()
          )
        )}
      </OpenInDrawer>
    );

    if (isDropdownItem) {
      return {
        key,
        label: drawerTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }
    return drawerTrigger;
  }

  // Pattern 2c: Drawer with route resolution
  // Supports both URL-based resolution and drawerConfigRef
  if (action.openInDrawer && (action.url || action.drawerConfigRef) && !action.openInModal) {
    const finalRouteParams = record ? { ...routeParams, ...record } : routeParams;

    const drawerTrigger = (
      <OpenRouteInDrawer
        key={key}
        url={action.url}
        routeParams={finalRouteParams}
        primaryIndex={primaryIndex}
        drawerConfigRef={action.drawerConfigRef}
        drawerTitle={action.drawerConfig?.title}
        placement={action.drawerConfig?.placement}
        width={action.drawerConfig?.width}
        height={action.drawerConfig?.height}
        closable={action.drawerConfig?.closable}
        mask={action.drawerConfig?.mask}
        maskClosable={action.drawerConfig?.maskClosable}
        destroyOnClose={action.drawerConfig?.destroyOnClose}
      >
        {wrapWithTooltip(
          isDropdownItem ? (
            evaluatedLabel
          ) : isTableRowAction ? (
            <Icon iconName={action.icon || "eye"} />
          ) : (
            renderPageHeaderButton()
          )
        )}
      </OpenRouteInDrawer>
    );

    if (isDropdownItem) {
      return {
        key,
        label: drawerTrigger,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined
      } as MenuItem;
    }
    return drawerTrigger;
  }

  // Pattern: Clone / duplicate action (#43)
  if (action.cloneConfig) {
    const { cloneConfig } = action;
    const handleClone = () => {
      if (isDisabled || !record) return;

      // Fields to always strip — identity, DynamoDB keys, timestamps
      const ALWAYS_EXCLUDE = new Set([
        'id', 'createdAt', 'updatedAt', 'pk', 'sk',
        'gsi1pk', 'gsi1sk', 'gsi2pk', 'gsi2sk', 'gsi3pk', 'gsi3sk', 'gsi4pk', 'gsi4sk',
        ...(cloneConfig.excludeFields ?? []),
      ]);

      // Any field whose key ends in 'Id' (teamId, userId, …) is also auto-excluded
      // unless the caller explicitly whitelisted it via includeFields.
      const isExcluded = (key: string): boolean =>
        ALWAYS_EXCLUDE.has(key) || (key.endsWith('Id') && key !== 'id');

      const raw: Record<string, unknown> = (record.__raw__ || record) as Record<string, unknown>;

      let prefill: Record<string, unknown>;
      if (cloneConfig.includeFields?.length) {
        // Whitelist mode — only the specified fields, skipping null/undefined
        prefill = Object.fromEntries(
          cloneConfig.includeFields
            .filter(k => raw[ k ] !== undefined && raw[ k ] !== null)
            .map(k => [ k, raw[ k ] ])
        );
      } else {
        // Auto mode — keep all primitive-valued fields that aren't excluded
        prefill = Object.fromEntries(
          Object.entries(raw).filter(([ k, v ]) =>
            v !== undefined && v !== null &&
            !isExcluded(k) &&
            typeof v !== 'object' // skip nested maps/lists — not safely URL-encodable
          )
        );
      }

      // Encode prefill as individual URL query params so FormPage.tsx can read them.
      // FormPage reads URLSearchParams directly when `prefill.enabled: true` is configured
      // on the target form; each param key becomes a field default value.
      const createUrl = substituteUrlParams(cloneConfig.createUrl, record, primaryIndex);
      const params = new URLSearchParams();
      for (const [ k, v ] of Object.entries(prefill)) {
        params.set(k, String(v));
      }
      const qs = params.toString();
      const sep = createUrl.includes('?') ? '&' : '?';
      onNavigate?.(`${createUrl}${qs ? sep + qs : ''}`);
    };

    if (isDropdownItem) {
      return {
        key,
        label: evaluatedLabel,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined,
        onClick: handleClone,
      } as MenuItem;
    }

    if (isTableRowAction) {
      return wrapWithTooltip(
        <a href="#" onClick={(e) => { e.preventDefault(); handleClone(); }}>
          <Icon iconName={action.icon || 'copy'} />
        </a>
      );
    }

    return wrapWithTooltip(renderPageHeaderButton(handleClone));
  }

  // Pattern: Clipboard copy action (#60)
  if (action.copyConfig) {
    const copyConfig = action.copyConfig;
    const handleCopy = () => {
      if (isDisabled) return;
      const records = selectedRecords && selectedRecords.length > 0
        ? selectedRecords
        : record ? [ record ] : [];
      if (records.length === 0) return;
      executeCopyToClipboard(records, copyConfig);
    };

    if (isDropdownItem) {
      return {
        key,
        label: evaluatedLabel,
        icon: action.icon ? <Icon iconName={action.icon} /> : undefined,
        onClick: handleCopy
      } as MenuItem;
    }

    if (isTableRowAction) {
      return wrapWithTooltip(
        <a href="#" onClick={(e) => { e.preventDefault(); handleCopy(); }}>
          <Icon iconName={action.icon || 'copy'} />
        </a>
      );
    }

    return wrapWithTooltip(
      renderPageHeaderButton(handleCopy)
    );
  }

  // Pattern 3: Regular navigation
  const rawUrl = action.url || '';
  const isBackAction = rawUrl === '__back__';

  let url = rawUrl;
  if (!isBackAction) {
    // Use the existing substituteUrlParams utility properly
    if (record) {
      // For table rows: use record data as routeParams and primaryIndex as fallback
      url = substituteUrlParams(url, record, primaryIndex);
    } else {
      // For page headers: use routeParams as is
      url = substituteUrlParams(url, routeParams);
    }
  }

  const external = !isBackAction && isExternalUrl(url);
  const { target, rel } = resolveAnchorProps(action.target, url);

  const handleNavigation = (e?: React.MouseEvent) => {
    if (isDisabled) return;
    if (e) e.preventDefault();

    if (isBackAction) {
      onNavigate?.(-1);
    } else if (target === '_blank' || external) {
      window.open(url, target || '_blank', 'noopener,noreferrer');
    } else {
      onNavigate?.(url);
    }
  };

  if (isDropdownItem) {
    return {
      key,
      label: evaluatedLabel,
      icon: action.icon ? <span style={{ marginRight: '8px' }}><Icon iconName={action.icon} /></span> : undefined,
      onClick: () => handleNavigation()
    } as MenuItem;
  }

  // For table rows, return Link with Icon
  if (isTableRowAction) {
    return wrapWithTooltip(
      <a
        href={isDisabled ? undefined : url}
        target={target}
        rel={rel}
        onClick={handleNavigation}
      >
        <Icon iconName={action.icon} />
      </a>
    );
  }

  // For page headers, return Button with optional icon
  return wrapWithTooltip(
    renderPageHeaderButton(() => handleNavigation())
  );
}

