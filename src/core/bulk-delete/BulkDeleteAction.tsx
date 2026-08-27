import React from "react";
import { Alert, Button, Collapse, Descriptions, Modal, Radio, Select, Space, Steps, Table as AntTable, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined } from "@ant-design/icons";

import { useApi } from "../context/ApiContext";
import { useAppContext } from "../context/AppContext";
import { getErrorStatus, handleApiError } from "../utils/api-error-handler";
import { invalidateEntityCacheByName } from "../query/useEntityMutation";
import { Table as FrameworkTable } from "../../table/Table";
import type { ITableDataChangePayload } from "../types/field-config";
import type { IBulkDeleteActionConfig, ITableConfig, ITableFilters } from "../../table/type";

/**
 * BulkDeleteAction — a dry-run-then-confirm bulk delete UI wired to fw24's
 * `getDeleteImpact` / `executeDeletePlan` mechanism (base-entity.ts / base-service.ts,
 * branch feat/overhaul-du-integration).
 *
 * These routes are OPT-IN on the backend (commented `// @Post(...)` on
 * `BaseEntityController` unless the app explicitly enables them, e.g. via
 * `deriveDeleteImpactOperations(Schema)`). There is currently no capability-metadata
 * fetch in ui24 for "does this entity support operation X" — the existing convention
 * for optional per-entity behavior is that the page config simply doesn't declare the
 * action when the backend doesn't support it. `bulkDeleteConfig` on an `IPageAction` IS
 * that signal: an app only wires this action in for an entity whose controller actually
 * exposes `/delete-impact` and `/execute-delete-plan`. Because that can still drift (the
 * config says one thing, a deploy/rollback changes the backend), a 404 from either route
 * is handled explicitly below instead of assumed away.
 */

type DeleteMode = "selection" | "query";
type RelationDeletePolicy = "cascade" | "setNull" | "restrict" | "orphan" | "ignore" | "custom";

/** Generic identifier-value bag: entity identifiers as plain key/value pairs. Mirrors fw24's BulkDeleteIdentifierValues. */
interface BulkDeleteIdentifierValues {
  readonly [ attributeName: string ]: unknown;
}

/** Generic attribute-value bag used for dry-run previews. Mirrors fw24's BulkDeletePreviewValues. */
interface BulkDeletePreviewValues {
  readonly [ attributeName: string ]: unknown;
}

/** Caller-supplied override of a relation's configured delete policy; only honored when the relation is `overridable`. */
interface RelationPolicyOverrides {
  readonly [ relationAttribute: string ]: RelationDeletePolicy | undefined;
}

/** Shared request shape for both `getDeleteImpact` (dry-run) and `executeDeletePlan`. */
interface DeletePlanPayload {
  readonly ids?: ReadonlyArray<BulkDeleteIdentifierValues>;
  readonly filters?: ITableFilters;
  readonly relationPolicyOverrides?: RelationPolicyOverrides;
  readonly maxItems?: number;
  readonly batchSize?: number;
  readonly concurrent?: number;
}

/** A reason a delete plan cannot execute as requested. Mirrors fw24's DeleteImpactBlocker. */
interface DeleteImpactBlocker {
  code: string;
  message: string;
  identifiers?: BulkDeleteIdentifierValues;
  relationAttribute?: string;
  context?: BulkDeletePreviewValues;
}

/** A single record targeted for deletion, with a preview of its attributes. Mirrors fw24's DeleteImpactTarget. */
interface DeleteImpactTarget {
  identifiers: BulkDeleteIdentifierValues;
  preview: BulkDeletePreviewValues;
}

/** The resolved impact of one relation with `relation.delete` configured. Mirrors fw24's RelationDeleteImpact. */
interface RelationDeleteImpact {
  relationAttribute: string;
  targetEntityName: string;
  label: string;
  policy: RelationDeletePolicy;
  overridable: boolean;
  items: Array<{
    parentIdentifiers: BulkDeleteIdentifierValues;
    identifiers: BulkDeleteIdentifierValues;
    preview: BulkDeletePreviewValues;
  }>;
  warnings?: string[];
  /** True only when `maxItems` genuinely stopped enumeration short of the real total for this relation. */
  truncated?: boolean;
  /** Nested relation-type metadata (fw24 sends the full `Relation<any>`; only a subset is used here). */
  relation?: {
    entityName: string;
    type?: string;
    delete?: {
      policy?: string;
      label?: string;
      warning?: string;
    };
  };
}

/** Dry-run result of walking direct targets plus every relation with `relation.delete` configured. Mirrors fw24's DeleteImpactResult. */
interface DeleteImpactResult {
  dryRun: true;
  entityName: string;
  direct: DeleteImpactTarget[];
  relations: RelationDeleteImpact[];
  blockers: DeleteImpactBlocker[];
  warnings: string[];
  /** True when ANY of the direct-target resolution or a relation walk hit its `maxItems` cap short of the real total. */
  truncated: boolean;
  totals: {
    direct: number;
    cascaded: number;
    orphaned: number;
    blocked: number;
    ignored: number;
  };
}

/** Outcome of `executeDeletePlan`. Mirrors fw24's BulkDeleteExecutionResult. */
interface BulkDeleteExecutionResult {
  entityName: string;
  deletedCount: number;
  failedCount: number;
  cascadedCount: number;
  orphanedCount: number;
  ignoredCount: number;
  totalProcessed: number;
  unprocessed: Array<BulkDeleteIdentifierValues>;
}

interface BulkDeleteRouteParams {
  readonly [ paramName: string ]: unknown;
  readonly filters?: unknown;
}

export type BulkDeleteTableContext = Pick<
  ITableConfig,
  | 'apiConfig'
  | 'propertiesConfig'
  | 'entityName'
  | 'defaultFilters'
  | 'segments'
  | 'fetchStrategy'
  | 'pageSize'
  | 'pagination'
  | 'emptyState'
  | 'density'
>;

interface BulkDeleteActionProps {
  config: IBulkDeleteActionConfig;
  label: string;
  icon?: React.ReactNode;
  selectedRecords?: ReadonlyArray<BulkDeletePreviewValues>;
  routeParams?: BulkDeleteRouteParams;
  tableContext?: BulkDeleteTableContext;
  disabled?: boolean;
  onSuccess?: (response?: BulkDeleteExecutionResult) => void;
}

const POLICY_OPTIONS: Array<{ value: RelationDeletePolicy; label: string }> = [
  { value: "cascade", label: "Delete related records" },
  { value: "setNull", label: "Clear relation field" },
  { value: "restrict", label: "Block delete" },
  { value: "orphan", label: "Keep as orphan" },
  { value: "ignore", label: "Ignore" },
];

const WIZARD_STEPS = [ { title: "Scope" }, { title: "Impact" }, { title: "Options" }, { title: "Confirm" } ] as const;

function isPlainObject(value: unknown): value is { readonly [ key: string ]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Backend opt-in routes return 404 when the app hasn't wired them up for this entity. */
function isNotEnabledError(error: unknown): boolean {
  return getErrorStatus(error) === 404;
}

function hasEffectiveFilters(filters: ITableFilters | undefined): boolean {
  if (!filters) return false;
  return Object.values(filters).some(value => value !== undefined && value !== null && value !== "");
}

function toTableRouteParams(routeParams: BulkDeleteRouteParams): { readonly [ paramName: string ]: string } {
  return Object.entries(routeParams).reduce<{ [ paramName: string ]: string }>((params, [ key, value ]) => {
    if (key !== "filters" && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      params[ key ] = String(value);
    }
    return params;
  }, {});
}

function pickIdentifiers(record: BulkDeletePreviewValues, identifierFields?: ReadonlyArray<string> | Array<string>): BulkDeleteIdentifierValues {
  const fields = identifierFields && identifierFields.length > 0 ? identifierFields : [ "id" ];
  const identifiers: { [ attributeName: string ]: unknown } = {};
  for (const field of fields) {
    if (record[ field ] !== undefined && record[ field ] !== null) {
      identifiers[ field ] = record[ field ];
    }
  }
  return Object.keys(identifiers).length > 0 ? identifiers : record;
}

function stablePreviewRowKey(
  row: BulkDeletePreviewValues,
  index: number,
  identifierFields?: ReadonlyArray<string> | Array<string>
): string {
  const keys = identifierFields && identifierFields.length > 0 ? identifierFields : [ "id" ];
  for (const k of keys) {
    const v = row[ k ];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return `preview-row-${index}`;
}

/** Generic cell renderer: no domain-specific field-name assumptions, just shape-based formatting. */
function formatImpactPreviewCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isNaN(value) ? "—" : String(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return "—";

    if (/^https?:\/\//.test(trimmed)) {
      return (
        <Typography.Link href={trimmed} target="_blank" rel="noreferrer" ellipsis>
          {trimmed}
        </Typography.Link>
      );
    }

    if (trimmed.length > 160) {
      return <Typography.Text ellipsis={{ tooltip: trimmed }} style={{ maxWidth: 220 }}>{trimmed}</Typography.Text>;
    }

    return trimmed;
  }

  if (typeof value === "object") {
    return (
      <Typography.Text code copyable style={{ fontSize: 12 }} ellipsis={{ tooltip: JSON.stringify(value, null, 2) }}>
        {JSON.stringify(value)}
      </Typography.Text>
    );
  }

  return String(value);
}

function collectPreviewKeys(rows: ReadonlyArray<BulkDeletePreviewValues>): string[] {
  const present = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) present.add(k);
  }
  return Array.from(present).sort((a, b) => a.localeCompare(b));
}

function buildImpactPreviewColumns(rows: ReadonlyArray<BulkDeletePreviewValues>): ColumnsType<BulkDeletePreviewValues> {
  const keys = collectPreviewKeys(rows);
  return keys.map(key => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: { showTitle: false },
    onCell: () => ({ style: { verticalAlign: "top" as const } }),
    width: 160,
    render: (value: unknown) => formatImpactPreviewCell(value),
  }));
}

function blockerMatchesDirectRow(rowIds: BulkDeleteIdentifierValues, blocker: DeleteImpactBlocker): boolean {
  if (!blocker.identifiers || !isPlainObject(blocker.identifiers)) return false;
  return Object.entries(blocker.identifiers).every(([ k, v ]) => rowIds[ k ] === v);
}

/** Merges each blocker's `context` (and code/message) into its matching direct preview row by identifier equality. */
function enrichDirectPreviewsWithBlockers(
  direct: DeleteImpactTarget[],
  blockers: DeleteImpactBlocker[]
): BulkDeletePreviewValues[] {
  return direct.map((entry) => {
    const out: Record<string, unknown> = { ...entry.preview };
    const blocker = blockers.find(b => blockerMatchesDirectRow(entry.identifiers, b));
    if (blocker) {
      if (blocker.context) {
        for (const [ k, v ] of Object.entries(blocker.context)) {
          if (out[ k ] === undefined) out[ k ] = v;
        }
      }
      out[ "blockerCode" ] = blocker.code;
      out[ "blockerMessage" ] = blocker.message;
    }
    return out;
  });
}

/** Flattens `parentIdentifiers` into preview row keys for relation tables so the source record is visible. */
function expandRelationItemToPreviewRow(
  item: { identifiers: BulkDeleteIdentifierValues; preview: BulkDeletePreviewValues; parentIdentifiers?: BulkDeleteIdentifierValues }
): BulkDeletePreviewValues {
  const out: Record<string, unknown> = { ...item.preview };
  if (item.parentIdentifiers && isPlainObject(item.parentIdentifiers)) {
    for (const [ k, v ] of Object.entries(item.parentIdentifiers)) {
      const slot = `parent_${k}`;
      if (out[ slot ] === undefined) out[ slot ] = v;
    }
  }
  return out;
}

const BLOCKER_DETAILS_COLUMNS: ColumnsType<DeleteImpactBlocker> = [
  { title: "Code", dataIndex: "code", key: "code", width: 200, ellipsis: true },
  { title: "Message", dataIndex: "message", key: "message", ellipsis: { showTitle: true } },
  {
    title: "Identifiers",
    dataIndex: "identifiers",
    key: "identifiers",
    width: 200,
    render: (value: unknown) => (value !== undefined
      ? <Typography.Text code copyable style={{ fontSize: 12 }}>{JSON.stringify(value)}</Typography.Text>
      : "—"
    ),
  },
  {
    title: "Context",
    dataIndex: "context",
    key: "context",
    width: 220,
    render: (value: unknown) => (value !== undefined && isPlainObject(value)
      ? <Typography.Text code copyable style={{ fontSize: 12 }} ellipsis={{ tooltip: JSON.stringify(value, null, 2) }}>{JSON.stringify(value)}</Typography.Text>
      : "—"
    ),
  },
];

function stableImpactSignature(impact: DeleteImpactResult | null): string {
  if (!impact) return "";
  return JSON.stringify({
    totals: impact.totals,
    truncated: impact.truncated,
    blockers: impact.blockers.map(blocker => ({ code: blocker.code, relationAttribute: blocker.relationAttribute })),
    relations: impact.relations.map(relation => ({
      relationAttribute: relation.relationAttribute,
      policy: relation.policy,
      count: relation.items.length,
      truncated: relation.truncated,
    })),
  });
}

export function BulkDeleteAction({
  config,
  label,
  icon,
  selectedRecords = [],
  routeParams = {},
  tableContext,
  disabled,
  onSuccess,
}: BulkDeleteActionProps) {
  const { callApiMethod } = useApi();
  const { notifySuccess, notifyError, notifyWarning } = useAppContext();
  const [ open, setOpen ] = React.useState(false);
  const [ step, setStep ] = React.useState(0);
  const [ mode, setMode ] = React.useState<DeleteMode>(selectedRecords.length > 0 ? "selection" : "query");
  const [ loading, setLoading ] = React.useState(false);
  const [ impact, setImpact ] = React.useState<DeleteImpactResult | null>(null);
  const [ notEnabled, setNotEnabled ] = React.useState(false);
  const [ overrides, setOverrides ] = React.useState<RelationPolicyOverrides>({});
  const [ queryFilters, setQueryFilters ] = React.useState<ITableFilters | undefined>(undefined);
  const [ result, setResult ] = React.useState<BulkDeleteExecutionResult | null>(null);

  const routeFilters = React.useMemo(
    () => (isPlainObject(routeParams.filters) ? routeParams.filters as ITableFilters : undefined),
    [ routeParams.filters ]
  );

  // Seed from route / table defaults when opening; `tableContext` object from parent
  // may be a new ref each render, so key off serialized default filters, not object identity.
  const defaultFiltersKey = tableContext?.defaultFilters ? JSON.stringify(tableContext.defaultFilters) : "";

  React.useEffect(() => {
    if (!open) return;
    setQueryFilters(routeFilters ?? (tableContext?.defaultFilters as ITableFilters | undefined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ open, routeFilters, defaultFiltersKey ]);

  const resetOnClose = () => {
    setOpen(false);
    setStep(0);
    setImpact(null);
    setResult(null);
    setNotEnabled(false);
    setOverrides({});
  };

  const ids = React.useMemo(
    () => selectedRecords.map(record => pickIdentifiers(record, config.identifierFields)),
    [ selectedRecords, config.identifierFields ]
  );

  const buildPayload = React.useCallback((): DeletePlanPayload => ({
    ids: mode === "selection" ? ids : undefined,
    filters: mode === "query" ? queryFilters : undefined,
    relationPolicyOverrides: overrides,
    maxItems: config.maxItems,
    batchSize: config.batchSize,
    concurrent: config.concurrent,
  }), [ mode, ids, queryFilters, overrides, config.maxItems, config.batchSize, config.concurrent ]);

  const impactApiUrl = config.impactApiUrl || (config.apiBaseUrl ? `${config.apiBaseUrl}/delete-impact` : undefined);
  const executeApiUrl = config.executeApiUrl || (config.apiBaseUrl ? `${config.apiBaseUrl}/execute-delete-plan` : undefined);

  const fetchImpact = React.useCallback(async (): Promise<DeleteImpactResult> => {
    if (!impactApiUrl) {
      throw new Error("Bulk delete is misconfigured: no impactApiUrl/apiBaseUrl provided.");
    }
    const response = await callApiMethod<DeleteImpactResult>({
      apiMethod: "POST",
      apiUrl: impactApiUrl,
      payload: buildPayload(),
      dedupe: false,
    });
    return response.data;
  }, [ callApiMethod, impactApiUrl, buildPayload ]);

  const loadImpact = async () => {
    setLoading(true);
    setNotEnabled(false);
    try {
      const nextImpact = await fetchImpact();
      setImpact(nextImpact);
      setStep(1);
    } catch (error) {
      if (isNotEnabledError(error)) {
        setNotEnabled(true);
      } else {
        notifyError(handleApiError(error, "Failed to load delete impact").errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!executeApiUrl) {
      notifyError("Bulk delete is misconfigured: no executeApiUrl/apiBaseUrl provided.");
      return;
    }

    setLoading(true);
    try {
      if (config.revalidateBeforeExecute !== false) {
        const nextImpact = await fetchImpact();
        if (stableImpactSignature(nextImpact) !== stableImpactSignature(impact)) {
          setImpact(nextImpact);
          setStep(1);
          notifyWarning("Delete impact changed since the last preview. Review the updated dry-run before confirming.");
          return;
        }
      }

      const response = await callApiMethod<BulkDeleteExecutionResult>({
        apiMethod: "POST",
        apiUrl: executeApiUrl,
        payload: buildPayload(),
        dedupe: false,
      });
      const executionResult = response.data;

      if (config.entityName) {
        invalidateEntityCacheByName(config.entityName);
      }
      config.invalidateRelated?.forEach(name => invalidateEntityCacheByName(name));

      if (executionResult.failedCount > 0) {
        notifyWarning(`Deleted ${executionResult.deletedCount} record(s); ${executionResult.failedCount} failed.`);
      } else {
        notifySuccess(`Deleted ${executionResult.deletedCount} record(s).`);
      }

      setResult(executionResult);
      setStep(4);
      onSuccess?.(executionResult);
    } catch (error) {
      if (isNotEnabledError(error)) {
        setNotEnabled(true);
        setStep(0);
      } else {
        notifyError(handleApiError(error, "Delete failed").errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNestedTableDataChange = React.useCallback((payload: ITableDataChangePayload) => {
    setQueryFilters((prev) => {
      const nextFilters = isPlainObject(payload.filters) ? payload.filters as ITableFilters : undefined;
      if (nextFilters !== undefined) {
        if (prev !== undefined && JSON.stringify(prev) === JSON.stringify(nextFilters)) return prev;
        return nextFilters;
      }
      return prev === undefined ? prev : undefined;
    });
  }, []);

  const queryDefaultFilters = routeFilters ?? (tableContext?.defaultFilters as ITableFilters | undefined);

  const directRows = React.useMemo(() => {
    if (!impact) return selectedRecords;
    return enrichDirectPreviewsWithBlockers(impact.direct, impact.blockers);
  }, [ impact, selectedRecords ]);

  const canUseSelection = config.allowSelectionDelete !== false && selectedRecords.length > 0;
  const canUseQuery = config.allowQueryDelete !== false && Boolean(tableContext);
  const canDryRun = mode === "selection" ? canUseSelection : canUseQuery && hasEffectiveFilters(queryFilters);

  const entityLabel = config.entityNamePlural || config.entityLabel || config.entityName || "records";

  return (
    <>
      <Button type="primary" danger disabled={disabled} onClick={() => setOpen(true)} icon={icon || <DeleteOutlined />}>
        {label}
      </Button>
      <Modal
        title={`Bulk delete ${entityLabel}`}
        open={open}
        width={1200}
        confirmLoading={loading}
        onCancel={resetOnClose}
        footer={[
          <Button key="cancel" onClick={resetOnClose}>{step === 4 ? "Close" : "Cancel"}</Button>,
          step > 0 && step < 4 && <Button key="back" onClick={() => setStep(step - 1)}>Back</Button>,
          step === 0 && <Button key="impact" type="primary" loading={loading} disabled={!canDryRun} onClick={loadImpact}>Dry Run</Button>,
          step > 0 && step < 3 && <Button key="next" type="primary" onClick={() => setStep(step + 1)}>Next</Button>,
          step === 3 && <Button key="delete" danger type="primary" loading={loading} disabled={(impact?.blockers.length ?? 0) > 0} onClick={execute}>Confirm Delete</Button>,
        ]}
      >
        {step < 4 && (
          <Steps size="small" current={step} items={[ ...WIZARD_STEPS ]} style={{ marginBottom: 24 }} />
        )}

        {notEnabled && (
          <Alert
            type="error"
            showIcon
            message="Bulk delete preview is not available"
            description={`This entity's backend does not expose the delete-impact/execute-delete-plan routes (received a 404). These routes are opt-in on the server; ask a backend maintainer to enable them for "${config.entityName || entityLabel}" before using this action.`}
            style={{ marginBottom: 16 }}
          />
        )}

        {step === 0 && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Radio.Group value={mode} onChange={(event) => setMode(event.target.value)}>
              <Radio.Button value="selection" disabled={!canUseSelection}>Selected records ({selectedRecords.length})</Radio.Button>
              <Radio.Button value="query" disabled={!canUseQuery}>Build query in table</Radio.Button>
            </Radio.Group>
            {mode === "selection" && selectedRecords.length === 0 && <Alert type="warning" message="Select records before using selection delete." />}
            {mode === "query" && !tableContext && <Alert type="error" message="Bulk delete table context is missing." />}
            {mode === "query" && tableContext && (
              <Space direction="vertical" style={{ width: "100%" }} size="middle">
                <Alert
                  type={hasEffectiveFilters(queryFilters) ? "info" : "warning"}
                  message={hasEffectiveFilters(queryFilters) ? "Review the filtered records below." : "Apply at least one table filter before running dry-run."}
                  description="The final filters currently applied to this table are used as the delete-by-query request."
                  showIcon
                />
                <FrameworkTable
                  {...tableContext}
                  routeParams={toTableRouteParams(routeParams)}
                  defaultFilters={queryDefaultFilters}
                  bulkActions={[]}
                  rowSelection={undefined}
                  showToolbar
                  showPagination
                  onDataChange={handleNestedTableDataChange}
                />
              </Space>
            )}
            <Typography.Paragraph type="secondary">
              The next step runs a dry-run only. No records are deleted until final confirmation.
            </Typography.Paragraph>
          </Space>
        )}

        {step === 1 && impact && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            {impact.truncated && (
              <Alert
                type="warning"
                showIcon
                message="This preview was truncated"
                description="The affected set is larger than the configured maxItems cap — some direct records or related records are not shown below. Totals reflect only what was walked, not the true full impact."
              />
            )}
            {impact.blockers.length > 0 && (
              <Alert
                type="error"
                showIcon
                message="Delete is blocked"
                description={(
                  <ol style={{ margin: "8px 0 0 0", paddingLeft: 20 }}>
                    {impact.blockers.map((b, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        <Typography.Text strong>{b.message}</Typography.Text>
                        {b.code
                          ? (
                            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                              ({b.code})
                            </Typography.Text>
                          )
                          : null}
                      </li>
                    ))}
                  </ol>
                )}
              />
            )}
            {impact.warnings.length > 0 && <Alert type="warning" showIcon message={impact.warnings.join(" ")} />}
            {impact.blockers.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginBottom: 8 }}>Blocker details</Typography.Title>
                <AntTable
                  size="small"
                  rowKey={(_, i) => `blocker-row-${i}`}
                  dataSource={impact.blockers}
                  columns={BLOCKER_DETAILS_COLUMNS}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                />
              </>
            )}

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3, lg: 6 }}>
              <Descriptions.Item label="Direct">{impact.totals.direct}</Descriptions.Item>
              <Descriptions.Item label="Cascade">{impact.totals.cascaded}</Descriptions.Item>
              <Descriptions.Item label="Orphaned">{impact.totals.orphaned}</Descriptions.Item>
              <Descriptions.Item label="Blocked">{impact.totals.blocked}</Descriptions.Item>
              <Descriptions.Item label="Ignored">{impact.totals.ignored}</Descriptions.Item>
              <Descriptions.Item label="Blocker rules">{impact.blockers.length}</Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{ marginBottom: 8 }}>Direct records to delete</Typography.Title>
            <AntTable
              size="small"
              rowKey={(row, i) => stablePreviewRowKey(row, i, config.identifierFields)}
              dataSource={[ ...directRows ]}
              columns={buildImpactPreviewColumns(directRows)}
              pagination={{ pageSize: 5 }}
              scroll={{ x: "max-content" }}
            />

            {impact.relations.length > 0 && (
              <>
                <Typography.Title level={5} style={{ margin: "8px 0" }}>Related & cascade impact</Typography.Title>
                <Collapse
                  defaultActiveKey={impact.relations.map((r, i) => `${r.relationAttribute}::${r.targetEntityName}::${i}`)}
                  items={impact.relations.map((rel, i) => {
                    const relRows = rel.items.map(expandRelationItemToPreviewRow);
                    return {
                      key: `${rel.relationAttribute}::${rel.targetEntityName}::${i}`,
                      label: (
                        <Space wrap>
                          <span>{rel.label}</span>
                          <Typography.Text type="secondary">
                            {rel.targetEntityName} · {rel.policy}
                            {rel.relation?.type ? ` · ${rel.relation.type}` : ""}
                          </Typography.Text>
                          <Typography.Text strong>({rel.items.length} rows)</Typography.Text>
                          {rel.truncated && <Tag color="warning">truncated</Tag>}
                        </Space>
                      ),
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }} size="small">
                          {rel.warnings && rel.warnings.length > 0 && (
                            <Alert type="info" showIcon message={rel.warnings.join(" ")} />
                          )}
                          {(!rel.warnings || rel.warnings.length === 0) && rel.relation?.delete?.warning && (
                            <Alert type="info" showIcon message={rel.relation.delete.warning} />
                          )}
                          {rel.items.length === 0
                            ? (
                              <Typography.Text type="secondary">
                                No related rows were included in this dry-run preview for this target.
                              </Typography.Text>
                            )
                            : (
                              <AntTable
                                size="small"
                                rowKey={(row, j) => stablePreviewRowKey(row, j, config.identifierFields)}
                                dataSource={relRows}
                                columns={buildImpactPreviewColumns(relRows)}
                                pagination={{ pageSize: 5 }}
                                scroll={{ x: "max-content" }}
                              />
                            )}
                        </Space>
                      ),
                    };
                  })}
                />
              </>
            )}
          </Space>
        )}

        {step === 2 && impact && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            {impact.relations.length === 0 && (
              <Typography.Text type="secondary">No overridable relation policies for this delete.</Typography.Text>
            )}
            {impact.relations.map((relation, ri) => (
              <Descriptions key={`${relation.relationAttribute}::${relation.targetEntityName}::${ri}`} bordered size="small" column={3}>
                <Descriptions.Item label="Relation">{relation.label}</Descriptions.Item>
                <Descriptions.Item label="Target">{relation.targetEntityName}</Descriptions.Item>
                <Descriptions.Item label="Affected">{relation.items.length}</Descriptions.Item>
                <Descriptions.Item label="Policy" span={3}>
                  {relation.overridable ? (
                    <Select
                      value={overrides[ relation.relationAttribute ] ?? relation.policy}
                      options={POLICY_OPTIONS}
                      style={{ width: 260 }}
                      onChange={(value) => setOverrides(prev => ({ ...prev, [ relation.relationAttribute ]: value }))}
                    />
                  ) : relation.policy}
                </Descriptions.Item>
              </Descriptions>
            ))}
          </Space>
        )}

        {step === 3 && impact && (
          <Alert
            type={impact.blockers.length > 0 ? "error" : "warning"}
            message={impact.blockers.length > 0 ? "Resolve blockers before deleting" : "Final confirmation"}
            description={`This will delete ${impact.totals.direct} direct record(s) and affect ${impact.totals.cascaded + impact.totals.orphaned + impact.totals.ignored} related record(s).`}
          />
        )}

        {step === 4 && result && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Alert
              type={result.failedCount > 0 ? "warning" : "success"}
              showIcon
              message={result.failedCount > 0 ? "Delete completed with some failures" : "Delete completed"}
              description={`Processed ${result.totalProcessed} record(s) for ${result.entityName}.`}
            />
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3, lg: 5 }}>
              <Descriptions.Item label="Deleted">{result.deletedCount}</Descriptions.Item>
              <Descriptions.Item label="Failed">{result.failedCount}</Descriptions.Item>
              <Descriptions.Item label="Cascaded">{result.cascadedCount}</Descriptions.Item>
              <Descriptions.Item label="Orphaned">{result.orphanedCount}</Descriptions.Item>
              <Descriptions.Item label="Ignored">{result.ignoredCount}</Descriptions.Item>
            </Descriptions>
            {result.unprocessed.length > 0 && (
              <>
                <Typography.Title level={5} style={{ marginBottom: 8 }}>Unprocessed records</Typography.Title>
                <AntTable
                  size="small"
                  rowKey={(_, i) => `unprocessed-row-${i}`}
                  dataSource={[ ...result.unprocessed ]}
                  columns={[ {
                    title: "Identifiers",
                    dataIndex: "identifiers",
                    key: "identifiers",
                    render: (_value: unknown, row: BulkDeleteIdentifierValues) => (
                      <Typography.Text code copyable style={{ fontSize: 12 }}>{JSON.stringify(row)}</Typography.Text>
                    ),
                  } ]}
                  pagination={{ pageSize: 5 }}
                  scroll={{ x: "max-content" }}
                />
              </>
            )}
          </Space>
        )}
      </Modal>
    </>
  );
}
