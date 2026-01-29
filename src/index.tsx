import 'antd-css-utilities/utility.min.css';
// import '@ant-design/v5-patch-for-react-19';
import "./global.css";

// IMPORTANT: Import dayjs setup early to extend plugins globally before Ant Design DatePicker uses them
import './core/dayjs';

export { UI24 } from "./UI24";
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