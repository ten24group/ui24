import 'antd-css-utilities/utility.min.css';
// import '@ant-design/v5-patch-for-react-19';
import "./global.css";

// IMPORTANT: Import dayjs setup early to extend plugins globally before Ant Design DatePicker uses them
import './core/dayjs';

export { UI24 } from "./UI24";
export { configure } from "./UI24";
export * from "./pages";
export * from "./layout";
export { AppRouter } from './routes/AppRouter'
export * from "./core";
export * from "./forms/Form";
export * from "./table/Table";
export * from "./detail/Details";
export * from "./routes/Navigation";
export * from "./modal";

// Export ExtensionRegistry for custom component registration
export { ExtensionRegistry, useResolverContext, buildResolverContext } from "./core/registry";
export type {
  FormFieldRendererProps,
  DetailFieldRendererProps,
  ColumnRendererProps,
  PageComponentProps,
  WidgetRendererProps,
  ResolverContext,
  RouteParams
} from "./core/registry";

// Export FieldTypeRegistry for custom field type registration
export { fieldTypeRegistry } from "./core/registry";
export type {
  FieldTypeRegistration,
  BuiltInFormFieldProps,
  BuiltInDetailFieldProps,
  BuiltInTableFieldProps,
} from "./core/registry";

// ── New Condition System Exports ──
// Registries (call at app init)
export { ConditionRegistry } from "./core/utils/ConditionRegistry";
export { CustomEvaluatorRegistry } from "./core/utils/CustomEvaluatorRegistry";

// Evaluator (for imperative usage outside React)
export { conditionEvaluator } from "./core/utils/ConditionEvaluator";

// Hooks
export { useCondition } from "./core/hooks/useCondition";
export { useConditionBatch } from "./core/hooks/useConditionBatch";
export { useResolve } from "./core/hooks/useResolve";
export { useResolveBatch } from "./core/hooks/useResolveBatch";

// Context
export { useNewEvaluationContext } from "./core/context/NewEvaluationContext";

// Types
export type {
  Condition,
  InlineCondition,
  ConditionalValue,
  NewEvaluationContext,
  CustomConditionFn,
} from "./core/types/evaluation";
export {
  isConditionalValue,
  isAndCondition,
  isOrCondition,
  isNotCondition,
  isRefCondition,
  isCustomCondition,
  resolveStringOrDefault,
} from "./core/types/evaluation";

// Shared abstraction for condition evaluation on item arrays
export { useEvaluatedItems } from "./core/hooks/useEvaluatedItems";
export type { EvaluatedItemsResult, UseEvaluatedItemsOptions } from "./core/hooks/useEvaluatedItems";

// Utilities
export { resolveDisabledMessage } from "./core/utils/resolveDisabledMessage";
export type {
  IContextProvider,
  IFeatureFlagProvider,
  ITenantProvider,
  IConditionSystemConfig,
} from "./core/context/types";