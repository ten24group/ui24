/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for DashboardPage widget rendering.
 *
 * The DashboardPage renders a grid of widgets from config. Each widget
 * can be a stat, chart, list, actions, detail, form, markdown, custom, etc.
 *
 * Verifies:
 * - Widgets render from config
 * - Widget visibility conditions work
 * - Layout (colSpan) is applied
 * - Time period selector shows when configured
 * - Empty dashboard handles gracefully
 * - Different widget types render
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock ESM-only dependencies ──
jest.mock('@blocknote/core', () => ({ BlockNoteEditor: { create: jest.fn() } }));
jest.mock('@blocknote/react', () => ({ useCreateBlockNote: jest.fn() }));
jest.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
jest.mock('jsonpath-plus', () => ({ JSONPath: jest.fn(() => undefined) }));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div data-testid="markdown">{children}</div> }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => {} }));
jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));

// Mock react-error-boundary — it wraps each widget
jest.mock('react-error-boundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

jest.mock('../../modal/Modal', () => ({
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
  OpenInModal: ({ button }: any) => button || null,
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'test-user', groups: ['admin'] },
  }),
}));
jest.mock('../../core/context/conditionSystemConfig', () => ({
  getConditionSystemConfig: () => ({}),
}));
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }) }),
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
jest.mock('../../core/common', () => ({
  Link: ({ children, to, title, url }: any) => <a href={to || url}>{children || title}</a>,
  ErrorFallback: ({ error }: any) => <div>Error: {error?.message}</div>,
  Icon: ({ iconName }: any) => <span data-testid={`icon-${iconName}`}>{iconName}</span>,
}));
jest.mock('../../core/common/Icons/Icons', () => ({
  Icon: ({ iconName }: any) => <span data-testid={`icon-${iconName}`}>{iconName}</span>,
}));
jest.mock('../../modal/Drawer', () => ({
  OpenInDrawer: ({ children }: any) => <div>{children}</div>,
}));
jest.mock('../../dashboard/widgets/TimePeriodSelector', () => ({
  TimePeriodSelector: () => <div data-testid="time-period-selector">TimePeriodSelector</div>,
}));

import { DashboardPage } from '../../pages/PostAuth/DashboardPage';
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
        formatConfig: {
          date: 'YYYY-MM-DD',
          time: 'hh:mm A',
          datetime: 'YYYY-MM-DD hh:mm A',
          boolean: { true: 'YES', false: 'NO' },
          timezone: 'UTC',
        },
      }}>
        <AppStaticProvider>
          <PageStaticProvider pageType="dashboard" entityName="" config={{}}>
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
// WIDGET RENDERING
// ============================================================================

describe('DashboardPage - widget rendering', () => {
  it('renders action widgets with labels', async () => {
    render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Quick Actions',
                options: {
                  actions: [
                    { label: 'Create Team', url: '/teams/create' },
                    { label: 'View Reports', url: '/reports' },
                  ],
                },
              } as any,
            ],
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Create Team')).toBeInTheDocument();
      expect(screen.getByText('View Reports')).toBeInTheDocument();
    });
  });

  it('renders markdown widgets', async () => {
    render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'markdown',
                title: 'Welcome',
                content: '# Hello World\nWelcome to the dashboard.',
              } as any,
            ],
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument();
    });
  });

  it('renders exactly N widget containers for N widgets configured', async () => {
    const { container } = render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Actions Widget',
                options: { actions: [{ label: 'Action 1', url: '/a1' }] },
              } as any,
              {
                type: 'actions',
                title: 'More Actions',
                options: { actions: [{ label: 'Action 2', url: '/a2' }] },
              } as any,
            ],
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Actions Widget')).toBeInTheDocument();
      expect(screen.getByText('More Actions')).toBeInTheDocument();
    });

    // Both widget action labels should be present
    expect(screen.getByText('Action 1')).toBeInTheDocument();
    expect(screen.getByText('Action 2')).toBeInTheDocument();

    // Verify exactly 2 grid items (one per widget)
    const gridItems = container.querySelectorAll('[style*="grid-column"]');
    expect(gridItems.length).toBe(2);
  });
});

// ============================================================================
// LAYOUT — colSpan grid sizing
// ============================================================================

describe('DashboardPage - colSpan layout', () => {
  it('applies colSpan to grid-column style (span N)', async () => {
    const { container } = render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Full Width',
                colSpan: 4,
                options: { actions: [{ label: 'A1', url: '/a' }] },
              } as any,
              {
                type: 'actions',
                title: 'Half Width',
                colSpan: 2,
                options: { actions: [{ label: 'A2', url: '/b' }] },
              } as any,
            ],
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Full Width')).toBeInTheDocument();
      expect(screen.getByText('Half Width')).toBeInTheDocument();
    });

    const gridItems = container.querySelectorAll('[style*="grid-column"]');
    expect(gridItems.length).toBe(2);

    // Verify each widget has a different span value in its grid-column style
    const styles = Array.from(gridItems).map(el => el.getAttribute('style') || '');
    const hasSpan4 = styles.some(s => s.includes('span 4'));
    const hasSpan2 = styles.some(s => s.includes('span 2'));
    expect(hasSpan4).toBe(true);
    expect(hasSpan2).toBe(true);
  });
});

// ============================================================================
// VISIBILITY CONDITIONS
// ============================================================================

describe('DashboardPage - widget visibility', () => {
  it('hides widgets with visibility: false', async () => {
    const { container } = render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Visible Widget',
                options: { actions: [{ label: 'Do Something', url: '/do' }] },
              } as any,
              {
                type: 'actions',
                title: 'Hidden Widget',
                visibility: false,
                options: { actions: [{ label: 'Secret', url: '/secret' }] },
              } as any,
            ],
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Visible Widget');
    });

    expect(container.textContent).not.toContain('Hidden Widget');
  });
});

// ============================================================================
// EMPTY CONFIG
// ============================================================================

describe('DashboardPage - empty config', () => {
  it('renders zero widget containers when dashboardConfig is missing', () => {
    const { container } = render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>
    );

    // No widget grid items should render
    const gridItems = container.querySelectorAll('[style*="grid-column"]');
    expect(gridItems.length).toBe(0);
  });

  it('renders zero widget containers when widgets array is empty', () => {
    const { container } = render(
      <TestWrapper>
        <DashboardPage dashboardConfig={{ widgets: [] }} />
      </TestWrapper>
    );

    const gridItems = container.querySelectorAll('[style*="grid-column"]');
    expect(gridItems.length).toBe(0);
  });
});

// ============================================================================
// TIME PERIOD SELECTOR
// ============================================================================

describe('DashboardPage - time period', () => {
  it('renders TimePeriodSelector when showTimePeriodSelector is true', async () => {
    render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Test Widget',
                options: { actions: [{ label: 'Action', url: '/a' }] },
              } as any,
            ],
            showTimePeriodSelector: true,
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('time-period-selector')).toBeInTheDocument();
    });
  });

  it('does NOT render TimePeriodSelector when showTimePeriodSelector is false/absent', async () => {
    render(
      <TestWrapper>
        <DashboardPage
          dashboardConfig={{
            widgets: [
              {
                type: 'actions',
                title: 'Test Widget',
                options: { actions: [{ label: 'Action', url: '/a' }] },
              } as any,
            ],
            // showTimePeriodSelector not set
          }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Widget')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('time-period-selector')).not.toBeInTheDocument();
  });
});
