import React, { useMemo } from 'react';
import { Alert } from 'antd';
import { StatWidget } from './widgets/StatWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { ListWidget } from './widgets/ListWidget';
import { ActionWidget } from './widgets/ActionWidget';
import { DetailWidget } from './widgets/DetailWidget';
import { FormWidget } from './widgets/FormWidget';
import { ModalWidget } from './widgets/ModalWidget';
import { ProgressWidget } from './widgets/ProgressWidget';
import { ControlWidget } from './widgets/ControlWidget';
import { TimelineWidget } from './widgets/TimelineWidget';
import { DescriptionWidget } from './widgets/DescriptionWidget';
import { MarkdownWidget } from './widgets/MarkdownWidget';
import { IDashboardWidgetConfig } from '../pages/PostAuth/DashboardPage';
import { TimePeriodSelectorProps } from './widgets/TimePeriodSelector';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../core/common';
import { ExtensionRegistry, useWidgetRenderer, type WidgetRendererProps, type RouteParams } from '../core/registry';
import { IS_DEV } from '../core/constants';

/**
 * Custom widget props configuration.
 */
interface CustomWidgetPropsConfig {
  readonly [ key: string ]: string | number | boolean | null | undefined |
  ReadonlyArray<string | number | boolean | null> |
  Readonly<CustomWidgetPropsConfig>;
}

/**
 * Props for custom widget components.
 */
interface ICustomWidgetComponentProps {
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
  readonly config: Readonly<CustomWidgetPropsConfig>;
  readonly title?: string;
  readonly timePeriod?: Readonly<{
    readonly start?: string;
    readonly end?: string;
    readonly preset?: 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom';
  }>;
}

/**
 * Time period configuration for dashboard.
 */
interface DashboardTimePeriod {
  period: string;
  range: [ unknown, unknown ];
}

export const WidgetRenderer: React.FC<{
  widget: IDashboardWidgetConfig;
  timePeriodSelectorProps?: TimePeriodSelectorProps;
  dashboardTimePeriod?: DashboardTimePeriod;
  routeParams?: Readonly<RouteParams>;
}> = ({ widget, timePeriodSelectorProps, dashboardTimePeriod, routeParams = {} }) => {

  const { Component: WidgetTypeOverride, props: widgetOverrideProps } = useWidgetRenderer(
    widget.type || '',
    {
      widget,
      timePeriod: dashboardTimePeriod ? {
        start: undefined,
        end: undefined,
        preset: dashboardTimePeriod.period as 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom'
      } : undefined,
      routeParams,
      depth: 0
    }
  );

  if (widget.type && widget.type !== 'custom' && WidgetTypeOverride && widgetOverrideProps) {
    return (
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <WidgetTypeOverride {...widgetOverrideProps} />
      </ErrorBoundary>
    );
  }

  // Memoize custom widget props to prevent unnecessary re-renders
  const customWidgetProps = useMemo((): ICustomWidgetComponentProps | null => {
    if (widget.type !== 'custom') return null;

    const customConfig = widget as IDashboardWidgetConfig & {
      componentKey?: string;
      componentProps?: CustomWidgetPropsConfig;
    };

    if (!customConfig.componentKey) return null;

    return {
      routeParams,
      depth: 0,
      config: customConfig.componentProps ?? {},
      title: widget.title,
      timePeriod: dashboardTimePeriod ? {
        preset: dashboardTimePeriod.period as 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth' | 'custom'
      } : undefined
    };
  }, [ widget, routeParams, dashboardTimePeriod ]);

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'stat':
        return <StatWidget {...widget} dashboardTimePeriod={dashboardTimePeriod} routeParams={routeParams} />;
      case 'chart':
        return <ChartWidget {...widget} timePeriodSelectorProps={timePeriodSelectorProps} dashboardTimePeriod={dashboardTimePeriod} routeParams={routeParams} />;
      case 'list': {
        const { propertiesConfig = [], apiConfig = { apiUrl: '', apiMethod: 'GET' }, ...rest } = widget.options || {};
        return <ListWidget propertiesConfig={propertiesConfig} apiConfig={apiConfig} title={widget.title} dashboardTimePeriod={dashboardTimePeriod} routeParams={routeParams} {...rest} />;
      }
      case 'actions': {
        const { actions = [] } = widget.options || {};
        return <ActionWidget title={widget.title} actions={actions} />;
      }
      case 'detail': {
        if (!widget.options?.propertiesConfig) {
          return <div>Detail widget requires propertiesConfig</div>;
        }
        return <DetailWidget title={widget.title} {...widget.options} />;
      }
      case 'form': {
        if (!widget.options?.propertiesConfig) {
          return <div>Form widget requires propertiesConfig</div>;
        }
        return <FormWidget title={widget.title} {...widget.options} />;
      }
      case 'modal': {
        const { triggers = [], layout = 'grid' } = widget.options || {};
        return <ModalWidget title={widget.title} triggers={triggers} layout={layout} />;
      }
      case 'progress': {
        if (typeof widget.options?.value !== 'number' || !widget.options?.progressType) {
          return <div>Progress widget requires value and progressType</div>;
        }
        return <ProgressWidget title={widget.title} {...widget.options} />;
      }
      case 'control': {
        const { controls = [], layout = 'vertical' } = widget.options || {};
        return <ControlWidget title={widget.title} controls={controls} layout={layout} />;
      }
      case 'timeline': {
        const { events = [], mode = 'left', reverse = false, maxEvents = 10 } = widget.options || {};
        return <TimelineWidget title={widget.title} events={events} mode={mode} reverse={reverse} maxEvents={maxEvents} />;
      }
      case 'description': {
        return <DescriptionWidget title={widget.title} {...widget} />;
      }
      case 'markdown': {
        return <MarkdownWidget title={widget.title} {...widget} />;
      }
      case 'custom': {
        // Custom widget rendering
        const customConfig = widget as IDashboardWidgetConfig & {
          componentKey?: string;
        };

        if (!customConfig.componentKey) {
          return (
            <Alert
              type="error"
              message="Invalid custom widget configuration"
              description="Custom widget requires 'componentKey' property."
            />
          );
        }

        const registration = ExtensionRegistry.getRegistration(customConfig.componentKey);

        if (!registration) {
          const availableWidgets = ExtensionRegistry.getByCategory('widget')
            .map(({ key }) => key)
            .join(', ');

          return (
            <Alert
              type="error"
              message={`Custom widget not found: "${customConfig.componentKey}"`}
              description={
                availableWidgets
                  ? `Available widgets: ${availableWidgets}`
                  : 'No custom widgets are registered.'
              }
            />
          );
        }

        if (registration.category !== 'widget' && IS_DEV) {
          console.warn(
            `[WidgetRenderer] Component "${customConfig.componentKey}" is category "${registration.category}", ` +
            `expected "widget". Rendering anyway.`
          );
        }

        const CustomWidget = registration.component as React.ComponentType<ICustomWidgetComponentProps>;

        if (!customWidgetProps) {
          return <div>Error building custom widget props</div>;
        }

        return <CustomWidget {...customWidgetProps} />;
      }
      default:
        return <div>Unknown widget type: {(widget as { type: string }).type}</div>;
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {}}
    >
      {renderWidgetContent()}
    </ErrorBoundary>
  );
};
