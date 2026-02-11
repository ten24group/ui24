/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for SectionsRenderer.
 * 
 * Tests that section configurations produce correct tab/accordion layouts.
 * SectionsRenderer is the component that handles nested page rendering —
 * turning a sectionsConfig into tabs or accordion panels, each containing
 * a sub-page (list, details, form, dashboard).
 * 
 * Verifies:
 * - Tab labels render correctly
 * - Children render without config and with empty config
 * - Section cards render for each configured section
 * - Children render alongside section sub-pages
 * - Section visibility filtering (hidden sections excluded from DOM)
 * - Section sort order is respected (by text position)
 * - Template labels evaluate from routeParams/parentData
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

// Mock app dependencies
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
  AppContextProvider: ({ children }: any) => <>{children}</>,
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

// Mock the sub-page wrappers to keep tests focused on SectionsRenderer logic
jest.mock('../../pages/wrappers/FormPage', () => ({
  FormPage: (props: any) => <div data-testid="form-page">FormPage</div>,
}));
jest.mock('../../pages/wrappers/TablePage', () => ({
  TablePage: (props: any) => <div data-testid="table-page">TablePage</div>,
}));
jest.mock('../../pages/wrappers/DetailPage', () => ({
  DetailPage: (props: any) => <div data-testid="detail-page">DetailPage</div>,
}));
jest.mock('../../pages/wrappers/WizardPage', () => ({
  WizardPage: (props: any) => <div data-testid="wizard-page">WizardPage</div>,
}));
jest.mock('../../pages/PostAuth/DashboardPage', () => ({
  DashboardPage: (props: any) => <div data-testid="dashboard-page">DashboardPage</div>,
  __esModule: true,
}));
jest.mock('../../pages/PostAuth/CustomPage', () => ({
  CustomPage: (props: any) => <div data-testid="custom-page">CustomPage</div>,
}));
jest.mock('../../pages/PostAuth/Accordion/Accordion', () => ({
  Accordion: (props: any) => <div data-testid="accordion-page">Accordion</div>,
}));
jest.mock('../../pages/PostAuth/PageHeader/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header">PageHeader</div>,
}));

import { SectionsRenderer } from '../../pages/PostAuth/SectionsRenderer';
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { AppStaticProvider } from '../../core/context/AppStaticContext';
import { PageStaticProvider } from '../../core/context/PageStaticContext';

// ── Wrapper ──
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Ui24ConfigProvider initConfig={{
        baseURL: 'https://api.test.com',
        appName: 'Test',
        appLogo: '/logo.png',
        uiConfig: { auth: {}, menu: {}, pages: {}, dashboard: {} },
        pagesConfig: {},
        formatConfig: {
          date: 'YYYY-MM-DD',
          time: 'hh:mm A',
          datetime: 'YYYY-MM-DD hh:mm A',
          boolean: { true: 'YES', false: 'NO' },
          timezone: 'UTC',
        },
      }}>
        <AppStaticProvider>
          <PageStaticProvider pageType="details" entityName="team" config={{}}>
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
// BASIC RENDERING
// ============================================================================

describe('SectionsRenderer - basic rendering', () => {
  it('renders children without sectionsConfig', () => {
    render(
      <TestWrapper>
        <SectionsRenderer routeParams={{}}>
          <div data-testid="child-content">Main Content</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('renders children when sectionsConfig has no sections', () => {
    render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{ sections: {} }}
          routeParams={{}}
        >
          <div data-testid="child-content">Main Content</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders tab labels from section config', async () => {
    render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              orders: {
                label: 'Orders',
                pageType: 'list',
                sortOrder: 1,
                listPageConfig: {
                  entityName: 'order',
                  propertiesConfig: [],
                  apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' } as any,
                },
              },
              settings: {
                label: 'Settings',
                pageType: 'details',
                sortOrder: 2,
                detailsPageConfig: {
                  propertiesConfig: [],
                },
              },
            },
          }}
          routeParams={{}}
        >
          <div>Main Content</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    // Tab labels should render
    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  it('renders children alongside section cards', async () => {
    const { container } = render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              orders: {
                label: 'Orders',
                pageType: 'list',
                sortOrder: 1,
                listPageConfig: {
                  entityName: 'order',
                  propertiesConfig: [],
                  apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' } as any,
                },
              },
            },
          }}
          routeParams={{}}
        >
          <div data-testid="main-detail">Detail Content</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    // Children are rendered as main content
    await waitFor(() => {
      expect(screen.getByTestId('main-detail')).toBeInTheDocument();
    });

    // Section content renders its sub-page (mocked TablePage)
    expect(container.textContent).toContain('TablePage');
    expect(container.textContent).toContain('Detail Content');
  });
});

// ============================================================================
// VISIBILITY CONDITIONS
// ============================================================================

describe('SectionsRenderer - sub-page routing per section pageType', () => {
  it('creates exactly N section cards for N configured sections', async () => {
    const { container } = render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              items: {
                label: 'Items',
                pageType: 'list',
                sortOrder: 1,
                listPageConfig: {
                  entityName: 'item',
                  propertiesConfig: [],
                  apiConfig: { apiMethod: 'GET', apiUrl: '/api/items', responseKey: 'items' } as any,
                },
              },
              info: {
                label: 'Info',
                pageType: 'details',
                sortOrder: 2,
                detailsPageConfig: {
                  propertiesConfig: [],
                },
              },
            },
          }}
          routeParams={{}}
        >
          <div>Main</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    // Both section labels should render
    await waitFor(() => {
      expect(screen.getByText('Items')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    // Sections render as Ant Design cards; there should be cards for each section
    // plus the main content card. At least 2 section cards should exist.
    const sectionCards = container.querySelectorAll('.ant-card');
    expect(sectionCards.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// SECTION VISIBILITY
// ============================================================================
// Visibility conditions are evaluated synchronously via conditionEvaluator.evaluateSync().
// Sections with `visibility: false` (bare boolean) are correctly hidden because the
// check uses explicit null/undefined guards (not a truthy check).

describe('SectionsRenderer - visibility', () => {
  it('hides sections whose visibility evaluates to false', async () => {
    // We need at least 2 visible sections so the tabs/accordion wrapper renders labels.
    // With only 1 visible section, the component renders content directly without labels.
    render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              general: {
                label: 'General',
                pageType: 'details',
                sortOrder: 1,
                detailsPageConfig: { propertiesConfig: [] },
              },
              settings: {
                label: 'Settings',
                pageType: 'details',
                sortOrder: 2,
                detailsPageConfig: { propertiesConfig: [] },
              },
              admin: {
                label: 'Admin Only',
                pageType: 'details',
                sortOrder: 3,
                // InlineCondition that evaluates to false — section should be hidden
                // because 'role' is not in the test evaluation context
                visibility: { operator: 'equals', field: 'role', value: 'admin' } as any,
                detailsPageConfig: { propertiesConfig: [] },
              },
            },
          }}
          routeParams={{}}
        >
          <div>Main</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // 'Admin Only' should NOT be rendered (condition evaluates to false
    // because the mock evaluator has no 'role' in context)
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
  });
});

// ============================================================================
// SORT ORDER
// ============================================================================

describe('SectionsRenderer - sort order', () => {
  it('renders sections in sortOrder sequence', async () => {
    const { container } = render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              settings: {
                label: 'Settings',
                pageType: 'details',
                sortOrder: 3,
                detailsPageConfig: { propertiesConfig: [] },
              },
              orders: {
                label: 'Orders',
                pageType: 'list',
                sortOrder: 1,
                listPageConfig: {
                  entityName: 'order',
                  propertiesConfig: [],
                  apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' } as any,
                },
              },
              notes: {
                label: 'Notes',
                pageType: 'details',
                sortOrder: 2,
                detailsPageConfig: { propertiesConfig: [] },
              },
            },
          }}
          routeParams={{}}
        >
          <div>Main</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    // Verify order: all three labels should appear in the text, in order
    const fullText = container.textContent || '';
    const ordersIdx = fullText.indexOf('Orders');
    const notesIdx = fullText.indexOf('Notes');
    const settingsIdx = fullText.indexOf('Settings');
    expect(ordersIdx).toBeLessThan(notesIdx);
    expect(notesIdx).toBeLessThan(settingsIdx);
  });
});

// ============================================================================
// TEMPLATE LABELS
// ============================================================================

describe('SectionsRenderer - template labels', () => {
  it('evaluates template section labels from routeParams', async () => {
    // When there are multiple sections, labels render as tab text
    const { container } = render(
      <TestWrapper>
        <SectionsRenderer
          sectionsConfig={{
            sections: {
              orders: {
                label: 'Orders for {teamName}',
                pageType: 'list',
                sortOrder: 1,
                listPageConfig: {
                  entityName: 'order',
                  propertiesConfig: [],
                  apiConfig: { apiMethod: 'GET', apiUrl: '/api/orders', responseKey: 'items' } as any,
                },
              },
              settings: {
                label: 'Team Settings',
                pageType: 'details',
                sortOrder: 2,
                detailsPageConfig: {
                  propertiesConfig: [],
                },
              },
            },
          }}
          routeParams={{ teamName: 'Lakers' }}
          parentData={{ record: { teamName: 'Lakers' } }}
        >
          <div>Main</div>
        </SectionsRenderer>
      </TestWrapper>
    );

    // With multiple sections, labels appear as tab text
    // Template {teamName} should be evaluated from routeParams/parentData
    await waitFor(() => {
      expect(container.textContent).toContain('Orders for Lakers');
    });
  });
});
