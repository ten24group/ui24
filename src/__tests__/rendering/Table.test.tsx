/// <reference types="@testing-library/jest-dom" />
/**
 * BEHAVIORAL tests for the Table component.
 *
 * These tests verify actual behavior, not just "it renders":
 * - API is called with correct URL, method, filters, pagination params
 * - Row selection checkboxes enable/disable bulk action toolbar
 * - Visibility conditions actually filter columns from the DOM
 * - Filter segments merge filters correctly into API calls
 * - Column data renders in correct <td> cells per row
 * - Empty state renders Ant Design's empty component
 * - routeParams substitute into apiUrl placeholders
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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
  OpenInModal: () => null,
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'test-user', groups: ['admin'], 'cognito:groups': ['admin'] },
    isLoggedIn: true,
    getToken: () => 'mock-token',
  }),
}));
jest.mock('../../core/context/conditionSystemConfig', () => ({
  getConditionSystemConfig: () => ({}),
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
  ErrorFallback: () => <div>Error</div>,
}));
jest.mock('../../core/common/Icons/Icons', () => ({
  Icon: ({ name }: any) => <span data-testid={`icon-${name}`}>{name}</span>,
}));

// ── Mock API ──
const mockCallApi = jest.fn();
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: mockCallApi }),
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

import { Table } from '../../table/Table';
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { AppStaticProvider } from '../../core/context/AppStaticContext';
import { PageStaticProvider } from '../../core/context/PageStaticContext';

// ── Mock data ──
const mockTeams = [
  { id: '1', name: 'Lakers', city: 'Los Angeles', status: 'active' },
  { id: '2', name: 'Warriors', city: 'San Francisco', status: 'active' },
  { id: '3', name: 'Bulls', city: 'Chicago', status: 'inactive' },
];

const makeApiResponse = (items: any[] = mockTeams) => ({
  status: 200,
  data: {
    items,
    total: items.length,
    lastEvaluatedKey: null,
  },
});

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
          <PageStaticProvider pageType="list" entityName="team" config={{}}>
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

const baseConfig = {
  entityName: 'team',
  propertiesConfig: [
    { name: 'name', dataIndex: 'name', fieldType: 'text' },
    { name: 'city', dataIndex: 'city', fieldType: 'text' },
    { name: 'status', dataIndex: 'status', fieldType: 'text' },
  ] as any,
  apiConfig: {
    apiMethod: 'GET' as const,
    apiUrl: '/api/teams',
    responseKey: 'items',
  },
};

// ============================================================================
// API CONTRACT — verify the Table calls the API correctly
// ============================================================================

describe('Table - API contract', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('calls callApiMethod with the configured apiUrl and apiMethod', async () => {
    render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(mockCallApi).toHaveBeenCalled());

    const callArg = mockCallApi.mock.calls[0][0];
    expect(callArg.apiUrl).toBe('/api/teams');
    expect(callArg.apiMethod).toBe('GET');
  });

  it('substitutes routeParams into apiUrl placeholders', async () => {
    render(
      <TestWrapper>
        <Table
          {...baseConfig}
          apiConfig={{ apiMethod: 'GET' as const, apiUrl: '/api/orgs/:orgId/teams', responseKey: 'items' }}
          routeParams={{ orgId: 'org-42' }}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(mockCallApi).toHaveBeenCalled());

    const callArg = mockCallApi.mock.calls[0][0];
    expect(callArg.apiUrl).toBe('/api/orgs/org-42/teams');
  });

  it('passes defaultFilters into the API payload with exact values', async () => {
    render(
      <TestWrapper>
        <Table
          {...baseConfig}
          defaultFilters={{ status: 'active', sport: 'basketball' }}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(mockCallApi).toHaveBeenCalled());

    const payload = mockCallApi.mock.calls[0][0].payload;
    expect(payload).toBeDefined();
    // defaultFilters values should be passed through exactly
    expect(payload.status).toBe('active');
    expect(payload.sport).toBe('basketball');
  });

  it('includes count param for pagination in database mode', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} pageSize={25} />
      </TestWrapper>
    );

    await waitFor(() => expect(mockCallApi).toHaveBeenCalled());

    const payload = mockCallApi.mock.calls[0][0].payload;
    expect(payload.count).toBe(25);
  });
});

// ============================================================================
// DATA → DOM — verify data from API actually reaches the correct cells
// ============================================================================

describe('Table - data rendering correctness', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('renders exactly N data rows for N records', async () => {
    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    // Ant Design table body rows (exclude header rows)
    const bodyRows = container.querySelectorAll('.ant-table-tbody tr.ant-table-row');
    expect(bodyRows.length).toBe(3);
  });

  it('renders each record field in the correct column position', async () => {
    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    // Get the first data row's cells
    const firstRow = container.querySelector('.ant-table-tbody tr.ant-table-row');
    expect(firstRow).toBeTruthy();

    const cells = firstRow!.querySelectorAll('td');
    const cellTexts = Array.from(cells).map(td => td.textContent?.trim());
    // propertiesConfig order: name, city, status → cells MUST be in this order
    expect(cellTexts[0]).toBe('Lakers');
    expect(cellTexts[1]).toBe('Los Angeles');
    expect(cellTexts[2]).toBe('active');
  });

  it('renders empty state when API returns zero records', async () => {
    mockCallApi.mockResolvedValue(makeApiResponse([]));

    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => {
      // Ant Design renders .ant-empty when no data
      const emptyEl = container.querySelector('.ant-empty');
      expect(emptyEl).toBeTruthy();
    });
  });

  it('does NOT render stale rows from a previous response', async () => {
    // First render with 3 teams
    mockCallApi.mockResolvedValue(makeApiResponse());

    const { container, unmount } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    unmount();

    // Second render with 1 team
    mockCallApi.mockResolvedValue(makeApiResponse([{ id: '4', name: 'Heat', city: 'Miami', status: 'active' }]));

    const { container: container2 } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Heat')).toBeInTheDocument());

    expect(screen.queryByText('Lakers')).not.toBeInTheDocument();
    expect(screen.queryByText('Warriors')).not.toBeInTheDocument();
  });
});

// ============================================================================
// COLUMN VISIBILITY — verify hidden/visibility columns don't reach DOM
// ============================================================================

describe('Table - column visibility', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('excludes columns with hidden: true from <th> headers', async () => {
    const { container } = render(
      <TestWrapper>
        <Table
          {...baseConfig}
          propertiesConfig={[
            { name: 'name', dataIndex: 'name', fieldType: 'text' },
            { name: 'secret', dataIndex: 'secret', fieldType: 'text', hidden: true },
            { name: 'city', dataIndex: 'city', fieldType: 'text' },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const headerTexts = Array.from(container.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headerTexts).toContain('name');
    expect(headerTexts).toContain('city');
    expect(headerTexts).not.toContain('secret');
  });

  it('excludes columns with visibility: false from <th> headers', async () => {
    const { container } = render(
      <TestWrapper>
        <Table
          {...baseConfig}
          propertiesConfig={[
            { name: 'name', dataIndex: 'name', fieldType: 'text' },
            { name: 'internal', dataIndex: 'internal', fieldType: 'text', visibility: false },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const headerTexts = Array.from(container.querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headerTexts).toContain('name');
    expect(headerTexts).not.toContain('internal');
  });

  it('hidden columns do not produce <td> cells per row', async () => {
    const { container } = render(
      <TestWrapper>
        <Table
          {...baseConfig}
          propertiesConfig={[
            { name: 'name', dataIndex: 'name', fieldType: 'text' },
            { name: 'secret', dataIndex: 'secret', fieldType: 'text', hidden: true },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const firstRow = container.querySelector('.ant-table-tbody tr.ant-table-row');
    const cellCount = firstRow!.querySelectorAll('td').length;
    // Only 1 visible column → 1 cell per row
    expect(cellCount).toBe(1);
  });
});

// ============================================================================
// ROW SELECTION — verify checkbox presence/absence and count
// ============================================================================

describe('Table - row selection behavior', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('renders N+1 checkboxes (header + N rows) when selection is enabled', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} rowSelection={{ enabled: true }} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    // 1 header "select all" + 3 row checkboxes
    expect(checkboxes.length).toBe(4);
  });

  it('renders zero checkboxes when selection is disabled', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} rowSelection={{ enabled: false }} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    expect(screen.queryAllByRole('checkbox').length).toBe(0);
  });

  it('renders zero checkboxes when no rowSelection config', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    expect(screen.queryAllByRole('checkbox').length).toBe(0);
  });

  it('selecting a row checkbox updates selection state', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} rowSelection={{ enabled: true }} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    // Click the first data row checkbox (index 1, since index 0 is "select all")
    fireEvent.click(checkboxes[1]);

    // The checkbox should now be checked
    await waitFor(() => {
      expect(checkboxes[1]).toBeChecked();
    });
  });

  it('select-all checkbox selects all row checkboxes', async () => {
    render(
      <TestWrapper>
        <Table {...baseConfig} rowSelection={{ enabled: true }} />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    // Click "select all" (index 0)
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      // All row checkboxes should be checked
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).toBeChecked();
      expect(checkboxes[3]).toBeChecked();
    });
  });
});

// ============================================================================
// FILTER SEGMENTS — verify segment tabs render and are interactive
// ============================================================================

describe('Table - filter segments', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('renders segment labels as clickable tabs', async () => {
    render(
      <TestWrapper>
        <Table
          {...baseConfig}
          segments={[
            { id: 'all', label: 'All Teams', filters: {}, isDefault: true },
            { id: 'active', label: 'Active Only', filters: { status: 'active' } },
            { id: 'inactive', label: 'Inactive', filters: { status: 'inactive' } },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('All Teams')).toBeInTheDocument();
      expect(screen.getByText('Active Only')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('clicking a segment triggers a new API call with the segment filters', async () => {
    render(
      <TestWrapper>
        <Table
          {...baseConfig}
          segments={[
            { id: 'all', label: 'All Teams', filters: {}, isDefault: true },
            { id: 'active', label: 'Active Only', filters: { status: 'active' } },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const initialCallCount = mockCallApi.mock.calls.length;

    // Click the "Active Only" segment
    fireEvent.click(screen.getByText('Active Only'));

    // A new API call should happen with the segment's filters merged in
    await waitFor(() => {
      expect(mockCallApi.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    // The latest call should include the segment's filter value
    const latestCall = mockCallApi.mock.calls[mockCallApi.mock.calls.length - 1][0];
    expect(latestCall.payload.status).toBe('active');
  });
});

// ============================================================================
// TOOLBAR — verify actual toolbar elements
// ============================================================================

describe('Table - toolbar', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue(makeApiResponse());
  });

  it('renders column settings button', async () => {
    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    // Column settings uses SettingOutlined icon with aria-label="setting"
    const settingIcon = container.querySelector('[aria-label="setting"]');
    expect(settingIcon).toBeTruthy();
  });

  it('renders auto-refresh indicator', async () => {
    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    // Auto-refresh uses SyncOutlined icon with aria-label="sync"
    const syncIcon = container.querySelector('[aria-label="sync"]');
    expect(syncIcon).toBeTruthy();
  });

  it('clicking refresh triggers a new API call', async () => {
    const { container } = render(<TestWrapper><Table {...baseConfig} /></TestWrapper>);

    await waitFor(() => expect(screen.getByText('Lakers')).toBeInTheDocument());

    const initialCallCount = mockCallApi.mock.calls.length;

    // Find and click the refresh button (ReloadOutlined with aria-label="reload")
    const reloadIcon = container.querySelector('[aria-label="reload"]');
    expect(reloadIcon).toBeTruthy();
    const reloadButton = reloadIcon!.closest('button');
    expect(reloadButton).toBeTruthy();

    fireEvent.click(reloadButton!);

    await waitFor(() => {
      expect(mockCallApi.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
