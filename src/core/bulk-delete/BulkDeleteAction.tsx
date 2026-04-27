import React from "react";
import { Alert, Button, Collapse, Descriptions, Modal, Radio, Select, Space, Steps, Table as AntTable, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined } from "@ant-design/icons";

import { useApi } from "../context/ApiContext";
import { useOperationExecutor } from "../services/OperationExecutor";
import { Table as FrameworkTable } from "../../table/Table";
import type { ITableDataChangePayload } from "../types/field-config";
import type { IBulkDeleteActionConfig, ITableConfig, ITableFilters, ITableFilterScalar, ITableFilterValue } from "../../table/type";

type DeleteMode = "selection" | "query";
type RelationDeletePolicy = "cascade" | "setNull" | "restrict" | "orphan" | "ignore" | "custom";

interface BulkDeleteRecord {
  readonly [ attributeName: string ]: unknown;
}

interface BulkDeleteIdentifierValues {
  readonly [ attributeName: string ]: unknown;
}

interface RelationPolicyOverrides {
  readonly [ relationAttribute: string ]: RelationDeletePolicy | undefined;
}

interface DeletePlanPayload {
  readonly ids?: ReadonlyArray<BulkDeleteIdentifierValues>;
  readonly filters?: ITableFilters;
  readonly relationPolicyOverrides: RelationPolicyOverrides;
  readonly maxItems?: number;
  readonly batchSize?: number;
  readonly concurrent?: number;
}

interface DeleteImpactBlocker {
  code: string;
  message: string;
  relationAttribute?: string;
  identifiers?: BulkDeleteIdentifierValues;
  context?: Record<string, unknown>;
}

interface DeleteImpactResult {
  entityName: string;
  direct: Array<{ identifiers: BulkDeleteIdentifierValues; preview: BulkDeleteRecord }>;
  relations: Array<{
    relationAttribute: string;
    targetEntityName: string;
    label: string;
    policy: RelationDeletePolicy;
    overridable: boolean;
    items: Array<{
      identifiers: BulkDeleteIdentifierValues;
      preview: BulkDeleteRecord;
      parentIdentifiers?: BulkDeleteIdentifierValues;
    }>;
    warnings?: string[];
    /** Nested relation spec from the API (policy copy, one-to-many metadata, etc.) */
    relation?: {
      entityName: string;
      type?: string;
      delete?: {
        policy?: string;
        label?: string;
        warning?: string;
        previewAttributes?: string[];
        maxItems?: number;
      };
    };
  }>;
  blockers: DeleteImpactBlocker[];
  warnings: string[];
  totals: {
    direct: number;
    cascaded: number;
    orphaned: number;
    blocked: number;
    ignored: number;
  };
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
  selectedRecords?: ReadonlyArray<BulkDeleteRecord>;
  routeParams?: BulkDeleteRouteParams;
  tableContext?: BulkDeleteTableContext;
  disabled?: boolean;
  onSuccess?: (response?: unknown) => void;
}

const POLICY_OPTIONS: Array<{ value: RelationDeletePolicy; label: string }> = [
  { value: "cascade", label: "Delete related records" },
  { value: "setNull", label: "Clear relation field" },
  { value: "restrict", label: "Block delete" },
  { value: "orphan", label: "Keep as orphan" },
  { value: "ignore", label: "Ignore" },
];

function isPlainObject(value: unknown): value is { readonly [ key: string ]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTableFilterScalar(value: unknown): value is ITableFilterScalar {
  return value === null || [ "string", "number", "boolean" ].includes(typeof value);
}

function isTableFilterValue(value: unknown): value is ITableFilterValue {
  return isTableFilterScalar(value) || (Array.isArray(value) && value.every(isTableFilterScalar));
}

function isTableFilters(value: unknown): value is ITableFilters {
  if (!isPlainObject(value)) return false;

  return Object.entries(value).every(([ key, entryValue ]) => {
    if (entryValue === undefined) return true;
    if (key === "filterId" || key === "filterLabel") return typeof entryValue === "string";
    if (key === "logicalOp") return entryValue === "and" || entryValue === "or";
    if (key === "and" || key === "or") return Array.isArray(entryValue) && entryValue.every(isTableFilters);
    if (isTableFilterValue(entryValue)) return true;

    if (!isPlainObject(entryValue)) return false;
    return Object.entries(entryValue).every(([ operator, operatorValue ]) => {
      if (operatorValue === undefined) return true;
      if (operator === "filterId" || operator === "filterLabel") return typeof operatorValue === "string";
      if (operator === "logicalOp") return operatorValue === "and" || operatorValue === "or";
      return isTableFilterValue(operatorValue);
    });
  });
}

function hasEffectiveFilters(filters: ITableFilters | undefined) {
  if (!filters) return false;
  return Object.entries(filters).some(([ key, value ]) => {
    if (value === undefined) return false;
    return ![ "filterId", "filterLabel", "logicalOp", "and", "or" ].includes(key) || (Array.isArray(value) && value.length > 0);
  });
}

function toTableRouteParams(routeParams: BulkDeleteRouteParams): { readonly [ paramName: string ]: string } {
  return Object.entries(routeParams).reduce<{ [ paramName: string ]: string }>((params, [ key, value ]) => {
    if (key !== "filters" && isTableFilterScalar(value) && value !== null) {
      params[ key ] = String(value);
    }
    return params;
  }, {});
}

function pickIdentifiers(record: BulkDeleteRecord, identifierFields?: ReadonlyArray<string> | Array<string>): BulkDeleteIdentifierValues {
  const fields = identifierFields && identifierFields.length > 0 ? identifierFields : [ "id" ];
  const identifiers: { [ attributeName: string ]: unknown } = {};
  for (const field of fields) {
    if (record[ field ] !== undefined && record[ field ] !== null) {
      identifiers[ field ] = record[ field ];
    }
  }
  return Object.keys(identifiers).length > 0 ? identifiers : record;
}

/** Show high-signal columns first; remaining keys follow in sorted order (all keys included). */
const DIRECT_PREVIEW_KEY_PRIORITY: readonly string[] = [
  "title",
  "status",
  "postType",
  "url",
  "postId",
  "parentPostId",
  "remoteId",
  "teamId",
  "publishDate",
  "summary",
  "deleteMessage",
  "blockerCode",
  "blockerMessage",
  "canBeDeleted",
  "featuredImage",
  "likeCount",
  "commentCount",
  "socialDistribution",
  "summaryBlocknote",
  "descriptionBlocknote",
  "content",
];

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tryParseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractBlocknotePlainText(raw: string): string {
  const parsed = tryParseJsonString(raw);
  if (!Array.isArray(parsed)) return raw;
  const texts: string[] = [];
  for (const block of parsed) {
    if (!isPlainObject(block)) continue;
    const content = block[ "content" ];
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (isPlainObject(c) && typeof c[ "text" ] === "string") {
        texts.push(c[ "text" ]);
      }
    }
  }
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

function collectOrderedPreviewKeys(rows: ReadonlyArray<BulkDeleteRecord>): string[] {
  const present = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      present.add(k);
    }
  }
  const out: string[] = [];
  for (const k of DIRECT_PREVIEW_KEY_PRIORITY) {
    if (present.has(k)) {
      out.push(k);
      present.delete(k);
    }
  }
  const rest = Array.from(present).sort((a, b) => a.localeCompare(b));
  return [ ...out, ...rest ];
}

function formatImpactPreviewCell(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (key === "canBeDeleted" && (value === 0 || value === 1)) return value === 1 ? "Yes" : "No";
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "null") return "—";

    const isHttp = /^https?:\/\//.test(trimmed);
    if (key === "url" || (isHttp && /url$/i.test(key))) {
      return (
        <Typography.Link href={trimmed} target="_blank" rel="noreferrer" ellipsis>
          {trimmed}
        </Typography.Link>
      );
    }

    if ((key === "featuredImage" || /image$/i.test(key) || /Image$/.test(key)) && isHttp) {
      return (
        <img
          alt=""
          src={trimmed}
          style={{ maxHeight: 48, maxWidth: 72, objectFit: "cover", borderRadius: 4, verticalAlign: "middle" }}
        />
      );
    }

    if (key === "socialDistribution" || key.endsWith("Distribution")) {
      const parsed = tryParseJsonString(trimmed);
      if (isPlainObject(parsed) && Array.isArray((parsed as { distributions?: unknown }).distributions)) {
        const dists = (parsed as { distributions: Array<Record<string, unknown>> }).distributions;
        return (
          <Space direction="vertical" size={0}>
            {dists.map((d, i) => {
              const platform = d.platform != null ? String(d.platform) : "?";
              const text = d.text != null ? String(d.text) : "";
              const short = text.length > 80 ? `${text.slice(0, 80)}…` : text;
              return (
                <Typography.Text key={i} style={{ fontSize: 12 }}>
                  <strong>{platform}</strong>
                  {short ? `: ${short}` : ""}
                </Typography.Text>
              );
            })}
          </Space>
        );
      }
    }

    if (key.toLowerCase().includes("blocknote")) {
      const plain = extractBlocknotePlainText(trimmed);
      if (plain) {
        return plain.length > 160 ? `${plain.slice(0, 160)}…` : plain;
      }
    }

    if ((key === "content" || key === "summary") && trimmed.includes("<")) {
      const plain = stripHtmlTags(trimmed);
      return plain.length > 200 ? `${plain.slice(0, 200)}…` : (plain || "—");
    }

    if (trimmed.length > 180 && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
      const p = tryParseJsonString(trimmed);
      if (p !== null) {
        return (
          <Typography.Text code copyable style={{ fontSize: 12, maxWidth: 240 }} ellipsis={{ tooltip: JSON.stringify(p, null, 2) }}>
            {JSON.stringify(p)}
          </Typography.Text>
        );
      }
    }

    if (trimmed.length > 200) {
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

function buildImpactPreviewColumns(rows: ReadonlyArray<BulkDeleteRecord>): ColumnsType<BulkDeleteRecord> {
  const keys = collectOrderedPreviewKeys(rows);
  return keys.map(key => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: { showTitle: false },
    onCell: () => ({ style: { verticalAlign: "top" } }),
    width: key === "featuredImage" ? 80 : key === "url" || key === "content" || key === "summary" ? 200 : 140,
    render: (value: unknown) => formatImpactPreviewCell(key, value),
  }));
}

function stablePreviewRowKey(
  row: BulkDeleteRecord,
  index: number,
  identifierFields?: ReadonlyArray<string> | Array<string> | undefined
): string {
  const keys = identifierFields && identifierFields.length > 0
    ? identifierFields
    : [ "postId", "id", "remoteId" ];
  for (const k of keys) {
    const v = row[ k ];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return `preview-row-${index}`;
}

/**
 * Merges duplicate relation blocks (same attribute + target + policy) and deduplicates
 * `items` by `identifiers` so the Impact UI matches totals (e.g. socialPosts).
 */
type ImpactRelation = DeleteImpactResult[ "relations" ][ number ];

function mergeImpactRelations(
  relations: DeleteImpactResult[ "relations" ]
): DeleteImpactResult[ "relations" ] {
  const map = new Map<string, ImpactRelation>();
  for (const rel of relations) {
    const mergeKey = `${rel.relationAttribute}::${rel.targetEntityName}::${rel.policy}::${rel.label}`;
    const existing = map.get(mergeKey);
    if (!existing) {
      map.set(mergeKey, {
        ...rel,
        items: [ ...rel.items ],
        warnings: rel.warnings ? [ ...rel.warnings ] : undefined,
      });
    } else {
      const seen = new Set(existing.items.map(i => JSON.stringify(i.identifiers)));
      for (const it of rel.items) {
        const sig = JSON.stringify(it.identifiers);
        if (!seen.has(sig)) {
          seen.add(sig);
          existing.items.push(it);
        }
      }
      if (rel.warnings?.length) {
        const merged = Array.from(new Set([ ...(existing.warnings ?? []), ...rel.warnings ]));
        existing.warnings = merged;
      }
      if (!existing.relation && rel.relation) {
        existing.relation = rel.relation;
      }
    }
  }
  return Array.from(map.values());
}

function blockerMatchesDirectRow(
  rowIds: BulkDeleteIdentifierValues,
  blocker: DeleteImpactBlocker
): boolean {
  if (!blocker.identifiers || !isPlainObject(blocker.identifiers)) return false;
  return Object.entries(blocker.identifiers).every(([ k, v ]) => rowIds[ k ] === v);
}

/**
 * Merges each blocker’s `context` (e.g. remoteId, teamId) and rule fields into the matching
 * direct preview row by identifier equality, so the impact table is useful even with sparse `preview` from the API.
 */
function enrichDirectPreviewsWithBlockers(
  direct: Array<{ identifiers: BulkDeleteIdentifierValues; preview: BulkDeleteRecord }>,
  blockers: DeleteImpactBlocker[]
): BulkDeleteRecord[] {
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

/**
 * Flattens `parentIdentifiers` (e.g. source post) into preview row keys for relation tables.
 */
function expandRelationItemToPreviewRow(
  item: { identifiers: BulkDeleteIdentifierValues; preview: BulkDeleteRecord; parentIdentifiers?: BulkDeleteIdentifierValues }
): BulkDeleteRecord {
  const out: Record<string, unknown> = { ...item.preview };
  if (item.parentIdentifiers && isPlainObject(item.parentIdentifiers)) {
    for (const [ k, v ] of Object.entries(item.parentIdentifiers)) {
      const slot = k === "postId" ? "parentPostId" : `parent_${k}`;
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

function stableImpactSignature(impact: DeleteImpactResult | null) {
  if (!impact) return "";
  return JSON.stringify({
    totals: impact.totals,
    blockers: impact.blockers.map(blocker => ({ code: blocker.code, relationAttribute: blocker.relationAttribute })),
    relations: impact.relations.map(relation => ({
      relationAttribute: relation.relationAttribute,
      policy: relation.policy,
      count: relation.items.length,
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
  const operationExecutor = useOperationExecutor();
  const [ open, setOpen ] = React.useState(false);
  const [ step, setStep ] = React.useState(0);
  const [ mode, setMode ] = React.useState<DeleteMode>(selectedRecords.length > 0 ? "selection" : "query");
  const [ loading, setLoading ] = React.useState(false);
  const [ impact, setImpact ] = React.useState<DeleteImpactResult | null>(null);
  const [ overrides, setOverrides ] = React.useState<RelationPolicyOverrides>({});
  const [ queryFilters, setQueryFilters ] = React.useState<ITableFilters | undefined>(undefined);

  const routeFilters = React.useMemo(
    () => isTableFilters(routeParams.filters) ? routeParams.filters : undefined,
    [ routeParams.filters ]
  );

  // Seed from route / table defaults when opening; `tableContext` object from parent
  // may be a new ref each render, so key off serialized default filters, not object identity.
  const defaultFiltersKey = tableContext?.defaultFilters
    ? JSON.stringify(tableContext.defaultFilters)
    : "";

  React.useEffect(() => {
    if (!open) return;
    setQueryFilters(routeFilters ?? tableContext?.defaultFilters);
  }, [ open, routeFilters, defaultFiltersKey ]);

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

  const fetchImpact = React.useCallback(async () => {
    const response = await callApiMethod<DeleteImpactResult>({
      apiMethod: "POST",
      apiUrl: config.impactApiUrl || `${config.apiBaseUrl}/delete-impact`,
      payload: buildPayload(),
      dedupe: false,
    });
    return response.data;
  }, [ callApiMethod, config.impactApiUrl, config.apiBaseUrl, buildPayload ]);

  const loadImpact = async () => {
    setLoading(true);
    try {
      const nextImpact = await fetchImpact();
      setImpact(nextImpact);
      setStep(1);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load delete impact");
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    setLoading(true);
    try {
      if (config.revalidateBeforeExecute !== false) {
        const nextImpact = await fetchImpact();
        if (stableImpactSignature(nextImpact) !== stableImpactSignature(impact)) {
          setImpact(nextImpact);
          setStep(1);
          message.warning("Delete impact changed. Review the updated dry-run before confirming.");
          return;
        }
      }

      await operationExecutor.execute(
        {
          apiConfig: {
            apiMethod: "POST",
            apiUrl: config.executeApiUrl || `${config.apiBaseUrl}/execute-delete-plan`,
            payload: buildPayload(),
            dedupe: false,
          },
          responseConfig: config.responseConfig,
          dynamicConfigKey: config.dynamicConfigKey,
          invalidateRelated: config.invalidateRelated ? [ ...config.invalidateRelated ] : undefined,
          successMessage: "Delete completed",
          onLoading: setLoading,
        },
        {
          onSuccess: (data) => {
            setOpen(false);
            setStep(0);
            setImpact(null);
            onSuccess?.(data);
          },
        }
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const handleNestedTableDataChange = React.useCallback((payload: ITableDataChangePayload) => {
    setQueryFilters((prev) => {
      if (isTableFilters(payload.filters)) {
        if (prev !== undefined && JSON.stringify(prev) === JSON.stringify(payload.filters)) {
          return prev;
        }
        return payload.filters;
      }
      return prev === undefined ? prev : undefined;
    });
  }, []);

  const queryDefaultFilters = routeFilters ?? tableContext?.defaultFilters;

  const directRows = React.useMemo(() => {
    if (!impact) return selectedRecords;
    return enrichDirectPreviewsWithBlockers(impact.direct, impact.blockers);
  }, [ impact, selectedRecords ]);

  const mergedRelations = React.useMemo(
    () => (impact ? mergeImpactRelations(impact.relations) : []),
    [ impact ]
  );

  const canUseSelection = config.allowSelectionDelete !== false && selectedRecords.length > 0;
  const canUseQuery = config.allowQueryDelete !== false && Boolean(tableContext);
  const canDryRun = mode === "selection" ? canUseSelection : canUseQuery && hasEffectiveFilters(queryFilters);

  return (
    <>
      <Button type="primary" danger disabled={disabled} onClick={() => setOpen(true)} icon={icon || <DeleteOutlined />}>
        {label}
      </Button>
      <Modal
        title={`Bulk delete ${config.entityNamePlural || config.entityLabel || config.entityName || "records"}`}
        open={open}
        width={1200}
        confirmLoading={loading}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>Cancel</Button>,
          step > 0 && <Button key="back" onClick={() => setStep(step - 1)}>Back</Button>,
          step === 0 && <Button key="impact" type="primary" loading={loading} disabled={!canDryRun} onClick={loadImpact}>Dry Run</Button>,
          step > 0 && step < 3 && <Button key="next" type="primary" onClick={() => setStep(step + 1)}>Next</Button>,
          step === 3 && <Button key="delete" danger type="primary" loading={loading} disabled={(impact?.blockers.length ?? 0) > 0} onClick={execute}>Confirm Delete</Button>,
        ]}
      >
        <Steps
          size="small"
          current={step}
          items={[ { title: "Scope" }, { title: "Impact" }, { title: "Options" }, { title: "Confirm" } ]}
          style={{ marginBottom: 24 }}
        />

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
                <Typography.Title level={5} style={{ marginBottom: 8 }}>Blocker details (API)</Typography.Title>
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
              <Descriptions.Item label="Orphans">{impact.totals.orphaned}</Descriptions.Item>
              <Descriptions.Item
                label={(
                  <Tooltip title="Per API totals.blocked (cascade count). This can be 0 while pre-delete blockers still apply.">
                    <span>Blocked (totals)</span>
                  </Tooltip>
                )}
              >
                {impact.totals.blocked}
              </Descriptions.Item>
              <Descriptions.Item label="Ignored">{impact.totals.ignored}</Descriptions.Item>
              <Descriptions.Item label="Blocker rules">{impact.blockers.length}</Descriptions.Item>
            </Descriptions>

            {mergedRelations.length === 0 && impact.totals.cascaded > 0 && (
              <Alert
                type="info"
                showIcon
                message="Cascade counts include related targets, but no relation blocks were returned for this run."
              />
            )}

            <Typography.Title level={5} style={{ marginBottom: 8 }}>Direct records to delete</Typography.Title>
            <AntTable
              size="small"
              rowKey={(row, i) => stablePreviewRowKey(row, i, config.identifierFields)}
              dataSource={[ ...directRows ]}
              columns={buildImpactPreviewColumns(directRows)}
              pagination={{ pageSize: 5 }}
              scroll={{ x: "max-content" }}
            />

            {mergedRelations.length > 0 && (
              <>
                <Typography.Title level={5} style={{ margin: "8px 0" }}>Related & cascade impact (all relations)</Typography.Title>
                <Collapse
                  defaultActiveKey={mergedRelations.map(
                    (r, i) => `${r.relationAttribute}::${r.targetEntityName}::${i}`
                  )}
                  items={mergedRelations.map((rel, i) => {
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
            {mergedRelations.map((relation, ri) => (
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
      </Modal>
    </>
  );
}
