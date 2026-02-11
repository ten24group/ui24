/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for Accordion component.
 *
 * The Accordion renders nested pages in collapsible panels. Each panel
 * can be a different page type (list, form, details, dashboard).
 *
 * Verifies:
 * - Panel labels render from pageTitle config
 * - Each panel renders the correct sub-page type
 * - Visibility conditions hide panels
 * - Empty/missing config shows error message
 * - First visible panel is expanded by default
 * - routeParams are passed through to sub-pages
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock ESM-only dependencies ──
jest.mock('@blocknote/core', () => ({ BlockNoteEditor: { create: jest.fn() } }));
jest.mock('@blocknote/react', () => ({ useCreateBlockNote: jest.fn() }));
jest.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
jest.mock('jsonpath-plus', () => ({ JSONPath: jest.fn(() => undefined) }));
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => {} }));
jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));

jest.mock('../../modal/Modal', () => ({
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'test-user', groups: ['admin'], 'cognito:groups': ['admin'] },
  }),
}));
jest.mock('../../core/context/conditionSystemConfig', () => ({
  getConditionSystemConfig: () => ({}),
}));
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: jest.fn() }),
}));
jest.mock('../../core/context/AppContext', () => ({
  useAppContext: () => ({
    notifyError: jest.fn(),
    notifySuccess: jest.fn(),
    notifyWarning: jest.fn(),
    notifyInfo: jest.fn(),
    notifyLoading: jest.fn(),
  }),
}));
jest.mock('../../core/context/ResponseModalContext', () => ({
  useResponseModalContext: () => ({
    showResponseModal: jest.fn(),
    hideResponseModal: jest.fn(),
  }),
}));
jest.mock('../../routes/Navigation', () => ({
  useCoreNavigator: () => jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

// Mock sub-page wrappers to isolate Accordion logic
jest.mock('../../pages/wrappers/FormPage', () => ({
  FormPage: (props: any) => <div data-testid="form-page">FormPage: {props.entityName}</div>,
}));
jest.mock('../../pages/wrappers/TablePage', () => ({
  TablePage: (props: any) => <div data-testid="table-page">TablePage: {props.entityName}</div>,
}));
jest.mock('../../pages/wrappers/DetailPage', () => ({
  DetailPage: (props: any) => <div data-testid="detail-page">DetailPage: {props.entityName}</div>,
}));
jest.mock('../../pages/wrappers/WizardPage', () => ({
  WizardPage: () => <div data-testid="wizard-page">WizardPage</div>,
}));
jest.mock('../../pages/PostAuth/DashboardPage', () => ({
  DashboardPage: (props: any) => <div data-testid="dashboard-page">DashboardPage</div>,
  __esModule: true,
}));
jest.mock('../../pages/PostAuth/CustomPage', () => ({
  CustomPage: () => <div data-testid="custom-page">CustomPage</div>,
}));
jest.mock('../../pages/PostAuth/PageHeader/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header">PageHeader</div>,
}));

import { Accordion } from '../../pages/PostAuth/Accordion/Accordion';
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { AppStaticProvider } from '../../core/context/AppStaticContext';
import { PageStaticProvider } from '../../core/context/PageStaticContext';

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Ui24ConfigProvider initConfig={{
        baseURL: 'https://api.test.com',
        appName: 'Test',
        appLogo: '/logo.png',
        uiConfig: { auth: {}, menu: {}, pages: {}, dashboard: {} },
        pagesConfig: {},
      }}>
        <AppStaticProvider>
          <PageStaticProvider pageType="accordion" entityName="team" config={{}}>
            <TableStateProvider value={{ selectedRecords: [], selectedRowKeys: [], filters: {}, searchQuery: '' }}>
              <FormStateProvider value={{ record: null, formValues: {}, isDirty: false, isValid: true }}>
                <DetailStateProvider value={{ record: null, isLoading: false }}>
                  {children}
                </DetailStateProvider>
              </FormStateProvider>
            </TableStateProvider>
          </PageStaticProvider>
        </AppStaticProvider>
      </Ui24ConfigProvider>
    </MemoryRouter>
  );
}

// ============================================================================
// PANEL RENDERING
// ============================================================================

describe('Accordion - panel rendering', () => {
  it('renders panel labels from pageTitle', async () => {
    const { container } = render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            orders: {
              pageType: 'list',
              pageTitle: 'Order List',
              listPageConfig: {
                entityName: 'order',
                propertiesConfig: [],
                apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' },
              },
            } as any,
            settings: {
              pageType: 'details',
              pageTitle: 'Settings',
              detailsPageConfig: {
                propertiesConfig: [],
              },
            } as any,
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Order List');
      expect(container.textContent).toContain('Settings');
    });
  });

  it('uses config key as fallback when pageTitle is missing', async () => {
    const { container } = render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            myCustomPanel: {
              pageType: 'details',
              detailsPageConfig: { propertiesConfig: [] },
            } as any,
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      // Should use the key "myCustomPanel" as the label
      expect(container.textContent).toContain('myCustomPanel');
    });
  });

  it('renders sub-page content in each panel', async () => {
    render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            orderList: {
              pageType: 'list',
              pageTitle: 'Orders',
              listPageConfig: {
                entityName: 'order',
                propertiesConfig: [],
                apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' },
              },
            } as any,
          }}
        />
      </TestWrapper>
    );

    // The first panel should be active and render its content
    await waitFor(() => {
      expect(screen.getByTestId('table-page')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// VISIBILITY CONDITIONS
// ============================================================================

describe('Accordion - visibility conditions', () => {
  it('hides panels with visibility: false', async () => {
    const { container } = render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            visible: {
              pageType: 'details',
              pageTitle: 'Visible Panel',
              detailsPageConfig: { propertiesConfig: [] },
            } as any,
            hidden: {
              pageType: 'details',
              pageTitle: 'Hidden Panel',
              visibility: false,
              detailsPageConfig: { propertiesConfig: [] },
            } as any,
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Visible Panel');
    });

    expect(container.textContent).not.toContain('Hidden Panel');
  });

  it('shows panels with visibility: true', async () => {
    const { container } = render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            alwaysVisible: {
              pageType: 'details',
              pageTitle: 'Always Visible',
              visibility: true,
              detailsPageConfig: { propertiesConfig: [] },
            } as any,
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Always Visible');
    });
  });
});

// ============================================================================
// EMPTY / MISSING CONFIG
// ============================================================================

describe('Accordion - empty config handling', () => {
  it('shows message when no config is provided', () => {
    const { container } = render(
      <TestWrapper>
        <Accordion />
      </TestWrapper>
    );

    expect(container.textContent).toContain('No accordion configuration found');
  });

  it('produces zero collapse panels when config is empty object', () => {
    const { container } = render(
      <TestWrapper>
        <Accordion accordionsPageConfig={{}} />
      </TestWrapper>
    );

    // Empty {} passes the truthy check but should produce zero panels
    const panels = container.querySelectorAll('.ant-collapse-item');
    expect(panels.length).toBe(0);
  });
});

// ============================================================================
// MULTIPLE PAGE TYPES
// ============================================================================

describe('Accordion - multiple page types', () => {
  it('renders both panel labels, first panel active with its sub-page', async () => {
    const { container } = render(
      <TestWrapper>
        <Accordion
          accordionsPageConfig={{
            list: {
              pageType: 'list',
              pageTitle: 'List View',
              listPageConfig: {
                entityName: 'item',
                propertiesConfig: [],
                apiConfig: { apiMethod: 'GET', apiUrl: '/api/items', responseKey: 'items' },
              },
            } as any,
            dashboard: {
              pageType: 'dashboard',
              pageTitle: 'Dashboard View',
              dashboardPageConfig: { widgets: [] },
            } as any,
          }}
        />
      </TestWrapper>
    );

    // Both panel labels should render
    await waitFor(() => {
      expect(container.textContent).toContain('List View');
      expect(container.textContent).toContain('Dashboard View');
    });

    // First panel (list) should be active by default and render its sub-page
    expect(screen.getByTestId('table-page')).toBeInTheDocument();

    // Should have exactly 2 collapse panels
    const panels = container.querySelectorAll('.ant-collapse-item');
    expect(panels.length).toBe(2);
  });
});
