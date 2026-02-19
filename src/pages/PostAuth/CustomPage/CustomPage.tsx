/**
 * CustomPage - Renders registered custom components based on configuration.
 * 
 * Handles:
 * 1. Component lookup from ExtensionRegistry
 * 2. Props resolution from config.componentProps and propsMapping
 * 3. Error boundaries for graceful failure
 * 4. Placeholder resolution for route params
 */

import React, { useMemo } from 'react';
import { Alert, Card } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { ErrorBoundary } from 'react-error-boundary';
import { ErrorFallback } from '../../../core/common';
import { ExtensionRegistry, type RouteParams, type PageComponentProps } from '../../../core/registry';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Custom page props configuration from backend.
 */
interface CustomPagePropsConfig {
  readonly [ key: string ]: string | number | boolean | null | undefined |
  ReadonlyArray<string | number | boolean | null> |
  Readonly<CustomPagePropsConfig>;
}

/**
 * Custom page configuration from backend.
 * Defines which component to render and how to configure it.
 */
export interface ICustomPageConfig {
  /** 
   * Component key registered in ExtensionRegistry.
   * Must match exactly.
   */
  readonly componentKey: string;

  /**
   * Static props to pass to the component.
   * Values can include placeholders like ':correlationId'.
   */
  readonly componentProps?: Readonly<CustomPagePropsConfig>;

  /**
   * Props mapping from route/context values to component props.
   * Keys are source paths, values are target prop names.
   * 
   * @example
   * propsMapping: {
   *   'correlationId': 'traceId',  // Route param to prop
   *   'selectedRecord.id': 'entityId'  // Nested path to prop
   * }
   */
  readonly propsMapping?: Readonly<PropsMappingConfig>;
}

/**
 * Props mapping configuration.
 * Maps source paths to target prop names.
 */
export interface PropsMappingConfig {
  readonly [ sourcePath: string ]: string;
}

/**
 * Props for CustomPage component.
 */
export interface CustomPageProps {
  /** Custom page configuration */
  readonly config: Readonly<ICustomPageConfig>;
  /** Route parameters from URL */
  readonly routeParams?: Readonly<RouteParams>;
  /** Current nesting depth */
  readonly depth?: number;
  /** Entity name from context */
  readonly entityName?: string;
}

/**
 * Props passed to custom page components.
 */
interface ICustomPageComponentProps {
  readonly routeParams: Readonly<RouteParams>;
  readonly depth: number;
  readonly entityName?: string;
  readonly config: Readonly<CustomPagePropsConfig>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resolve a value from nested path in an object.
 * Supports dot notation: 'parent.child.value'
 */
function resolvePath(
  obj: Readonly<RouteParams>,
  path: string
): string | number | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Readonly<{ [ key: string ]: unknown }>)[ part ];
  }

  // Only return string or number values
  if (typeof current === 'string' || typeof current === 'number') {
    return current;
  }
  return undefined;
}

/**
 * Check if a value is a placeholder (starts with ':')
 */
function isPlaceholder(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(':');
}

/**
 * Resolve placeholders in component props.
 * Transforms ':paramName' into actual values from routeParams.
 */
function resolveComponentProps(
  componentProps: Readonly<CustomPagePropsConfig> | undefined,
  propsMapping: Readonly<PropsMappingConfig> | undefined,
  routeParams: Readonly<RouteParams>
): Readonly<CustomPagePropsConfig> {
  const resolved: { [ key: string ]: unknown } = {};

  // First, copy and resolve componentProps
  if (componentProps) {
    for (const [ key, value ] of Object.entries(componentProps)) {
      if (isPlaceholder(value)) {
        // ':paramName' → routeParams[paramName]
        const paramName = value.slice(1);
        const resolvedValue = resolvePath(routeParams, paramName);
        resolved[ key ] = resolvedValue;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively resolve nested objects
        resolved[ key ] = resolveComponentProps(
          value as Readonly<CustomPagePropsConfig>,
          undefined,
          routeParams
        );
      } else {
        resolved[ key ] = value;
      }
    }
  }

  // Then, apply propsMapping
  if (propsMapping) {
    for (const [ sourcePath, targetProp ] of Object.entries(propsMapping)) {
      const sourceValue = resolvePath(routeParams, sourcePath);
      if (sourceValue !== undefined) {
        resolved[ targetProp ] = sourceValue;
      }
    }
  }

  return resolved as Readonly<CustomPagePropsConfig>;
}

// ============================================================================
// COMPONENT NOT FOUND UI
// ============================================================================

interface ComponentNotFoundProps {
  readonly componentKey: string;
}

const ComponentNotFound: React.FC<ComponentNotFoundProps> = ({ componentKey }) => {
  const availableComponents = useMemo(() => {
    return ExtensionRegistry.getByCategory('page')
      .map(({ key, registration }) => ({
        key,
        description: registration.description
      }));
  }, []);

  return (
    <Card style={{ margin: 16 }}>
      <Alert
        type="error"
        icon={<ExclamationCircleOutlined />}
        showIcon
        message={`Custom component not found: "${componentKey}"`}
        description={
          <div>
            <p>
              The component &quot;{componentKey}&quot; is not registered in ExtensionRegistry.
            </p>
            <p style={{ marginTop: 8 }}>
              <strong>To fix this:</strong> Register the component before rendering UI24:
            </p>
            <pre style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              marginTop: 8,
              overflow: 'auto'
            }}>
              {`import { ExtensionRegistry } from '@ten24group/ui24';
import { ${componentKey} } from './components/${componentKey}';

ExtensionRegistry.register({
  key: '${componentKey}',
  component: ${componentKey},
  category: 'page'
});`}
            </pre>
            {availableComponents.length > 0 && (
              <>
                <p style={{ marginTop: 16 }}>
                  <strong>Available page components:</strong>
                </p>
                <ul style={{ marginTop: 8 }}>
                  {availableComponents.map(({ key, description }) => (
                    <li key={key}>
                      <code>{key}</code>
                      {description && <span> - {description}</span>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {availableComponents.length === 0 && (
              <p style={{ marginTop: 8, color: '#666' }}>
                No custom page components are currently registered.
              </p>
            )}
          </div>
        }
      />
    </Card>
  );
};

// ============================================================================
// CUSTOM PAGE COMPONENT
// ============================================================================

/**
 * CustomPage - Renders a registered custom component.
 * 
 * Usage:
 * - Backend config specifies componentKey and componentProps
 * - This component looks up the registered component
 * - Resolves any placeholders in props
 * - Renders with error boundary protection
 */
export const CustomPage: React.FC<CustomPageProps> = ({
  config,
  routeParams = {},
  depth = 0,
  entityName
}) => {
  // Validate config
  if (!config.componentKey) {
    return (
      <Alert
        type="error"
        message="Invalid custom page configuration"
        description="The 'componentKey' is required in custom page configuration."
        style={{ margin: 16 }}
      />
    );
  }

  // Look up the registered component
  const CustomComponent = ExtensionRegistry.get<ICustomPageComponentProps>(
    config.componentKey
  );

  // Component not found - show helpful error
  if (!CustomComponent) {
    return <ComponentNotFound componentKey={config.componentKey} />;
  }

  // Resolve props with placeholders
  const resolvedConfig = useMemo(
    () => resolveComponentProps(
      config.componentProps,
      config.propsMapping,
      routeParams
    ),
    [ config.componentProps, config.propsMapping, routeParams ]
  );

  // Build final props for custom component
  const componentProps: ICustomPageComponentProps = useMemo(
    () => ({
      routeParams,
      depth,
      entityName,
      config: resolvedConfig
    }),
    [ routeParams, depth, entityName, resolvedConfig ]
  );

  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <Card style={{ margin: 16 }}>
          <ErrorFallback
            error={error}
            resetErrorBoundary={resetErrorBoundary}
          />
        </Card>
      )}
      onReset={() => {}}
    >
      <CustomComponent {...componentProps} />
    </ErrorBoundary>
  );
};
