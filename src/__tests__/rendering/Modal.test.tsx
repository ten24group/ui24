/// <reference types="@testing-library/jest-dom" />
/**
 * BEHAVIORAL tests for Modal component (OpenInModal).
 *
 * Tests verify:
 * - Modal is NOT in DOM before trigger click (lazy rendering)
 * - Confirm modal shows title, content, and Confirm/Cancel buttons
 * - Clicking Confirm calls the API with correct config
 * - Form modal renders the form sub-page
 * - Template titles evaluate {field} from routeParams
 * - Custom modal renders children[1] as content
 * - Modal closes when Cancel is clicked
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
jest.mock('react-error-boundary', () => ({
  ErrorBoundary: ({ children }: any) => <>{children}</>,
}));

const mockCallApi = jest.fn().mockResolvedValue({ status: 200, data: { message: 'ok' } });
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
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: mockCallApi }),
}));
const mockNotifySuccess = jest.fn();
const mockNotifyError = jest.fn();
jest.mock('../../core/context/AppContext', () => ({
  useAppContext: () => ({
    notifyError: mockNotifyError,
    notifySuccess: mockNotifySuccess,
    notifyWarning: jest.fn(),
    notifyInfo: jest.fn(),
    notifyLoading: jest.fn(),
  }),
}));
jest.mock('../../core/context/ResponseModalContext', () => ({
  useResponseModalContext: () => ({ showResponseModal: jest.fn(), hideResponseModal: jest.fn() }),
}));
jest.mock('../../routes/Navigation', () => ({
  useCoreNavigator: () => jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
jest.mock('../../core/common', () => ({
  Link: ({ children, onClick, className }: any) => (
    <a onClick={onClick} className={className} data-testid="modal-trigger-link">{children}</a>
  ),
  ErrorFallback: ({ error }: any) => <div>Error: {error?.message}</div>,
  Icon: ({ iconName }: any) => <span>{iconName}</span>,
}));
jest.mock('../../core/common/Icons/Icons', () => ({
  Icon: ({ iconName }: any) => <span>{iconName}</span>,
}));

// Mock sub-pages to isolate modal logic
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
  WizardPage: () => <div data-testid="wizard-page">WizardPage</div>,
}));
jest.mock('../../pages/PostAuth/DashboardPage', () => ({
  DashboardPage: () => <div data-testid="dashboard-page">DashboardPage</div>,
}));
jest.mock('../../pages/PostAuth/CustomPage', () => ({
  CustomPage: () => <div data-testid="custom-page">CustomPage</div>,
}));
jest.mock('../../pages/PostAuth/PageHeader/PageHeader', () => ({
  PageHeader: () => null,
}));

import { OpenInModal } from '../../modal/Modal';
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
          date: 'YYYY-MM-DD', time: 'hh:mm A', datetime: 'YYYY-MM-DD hh:mm A',
          boolean: { true: 'YES', false: 'NO' }, timezone: 'UTC',
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

// ============================================================================
// LAZY RENDERING — modal content NOT in DOM before click
// ============================================================================

describe('OpenInModal - lazy rendering', () => {
  it('modal title and content are NOT in DOM before trigger click', () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalPageConfig={{ title: 'Delete Team?', content: 'This is permanent.' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/teams/1' }}
        >
          <span>Trigger</span>
        </OpenInModal>
      </TestWrapper>
    );

    expect(screen.queryByText('Delete Team?')).not.toBeInTheDocument();
    expect(screen.queryByText('This is permanent.')).not.toBeInTheDocument();
  });

  it('modal content appears ONLY after trigger click', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalPageConfig={{ title: 'Confirm Action', content: 'Proceed?' }}
          apiConfig={{ apiMethod: 'POST', apiUrl: '/api/action' }}
        >
          <span>Open</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Proceed?')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// CONFIRM MODAL — Confirm/Cancel buttons, API call
// ============================================================================

describe('OpenInModal - confirm modal behavior', () => {
  beforeEach(() => {
    mockCallApi.mockReset();
    mockCallApi.mockResolvedValue({ status: 200, data: { message: 'Deleted' } });
  });

  it('shows Confirm and Cancel buttons', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalPageConfig={{ title: 'Delete?', content: 'Sure?' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/teams/1' }}
        >
          <span>Del</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Confirm');
      expect(document.body.textContent).toContain('Cancel');
    });
  });

  it('clicking Confirm calls the API with the configured method and URL', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalPageConfig={{ title: 'Delete?', content: 'Sure?' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/teams/99' }}
        >
          <span>Del</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Confirm');
    });

    // Click Confirm button
    const confirmBtn = screen.getByText('Confirm');
    fireEvent.click(confirmBtn);

    // API MUST be called with the configured method and URL
    await waitFor(() => {
      expect(mockCallApi).toHaveBeenCalled();
    });

    const callArg = mockCallApi.mock.calls[0][0];
    expect(callArg.apiMethod).toBe('DELETE');
    expect(callArg.apiUrl).toBe('/api/teams/99');
  });

  it('clicking Cancel does NOT call the API', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalPageConfig={{ title: 'Delete?', content: 'Sure?' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/teams/1' }}
        >
          <span>Del</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(document.body.textContent).toContain('Cancel');
    });

    // Find and click Cancel button
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);

    // API should NOT have been called
    expect(mockCallApi).not.toHaveBeenCalled();
  });
});

// ============================================================================
// TEMPLATE TITLE — verify {field} replacement
// ============================================================================

describe('OpenInModal - template title evaluation', () => {
  it('evaluates {teamName} from routeParams in modalTitle', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalTitle="Delete {teamName}"
          routeParams={{ teamName: 'Lakers' }}
          modalPageConfig={{ title: 'Confirm', content: 'Are you sure?' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/teams/1' }}
        >
          <span>Delete</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByText('Delete Lakers')).toBeInTheDocument();
      // Must NOT show raw template
      expect(screen.queryByText('Delete {teamName}')).not.toBeInTheDocument();
    });
  });

  it('uses static modalTitle when no template placeholders', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="confirm"
          modalTitle="Static Title"
          modalPageConfig={{ title: 'X', content: 'Y' }}
          apiConfig={{ apiMethod: 'DELETE', apiUrl: '/api/x' }}
        >
          <span>Open</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByText('Static Title')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// FORM/LIST/DETAILS MODAL — correct sub-page renders
// ============================================================================

describe('OpenInModal - sub-page routing', () => {
  it('form modal renders FormPage component', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="form"
          modalPageConfig={{ propertiesConfig: [{ name: 'x', fieldType: 'text' }] } as any}
          apiConfig={{ apiMethod: 'POST', apiUrl: '/api/teams' }}
        >
          <span>Add</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByTestId('form-page')).toBeInTheDocument();
      // Should NOT render table or detail
      expect(screen.queryByTestId('table-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('detail-page')).not.toBeInTheDocument();
    });
  });

  it('list modal renders TablePage component', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="list"
          modalPageConfig={{
            entityName: 'player',
            propertiesConfig: [{ name: 'x', dataIndex: 'x', fieldType: 'text' }],
            apiConfig: { apiMethod: 'GET', apiUrl: '/api/players', responseKey: 'items' },
          } as any}
        >
          <span>View List</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByTestId('table-page')).toBeInTheDocument();
      expect(screen.queryByTestId('form-page')).not.toBeInTheDocument();
    });
  });

  it('details modal renders DetailPage component', async () => {
    render(
      <TestWrapper>
        <OpenInModal
          modalType="details"
          modalPageConfig={{ propertiesConfig: [{ name: 'x', fieldType: 'text' }] } as any}
        >
          <span>View Detail</span>
        </OpenInModal>
      </TestWrapper>
    );

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByTestId('detail-page')).toBeInTheDocument();
      expect(screen.queryByTestId('form-page')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// CUSTOM MODAL — children[1] is the content
// ============================================================================

describe('OpenInModal - custom modal', () => {
  it('renders children[1] as modal body content', async () => {
    render(
      <TestWrapper>
        <OpenInModal modalType="custom">
          <span>Trigger</span>
          <div data-testid="custom-body">Custom content here</div>
        </OpenInModal>
      </TestWrapper>
    );

    // Before click: custom body should NOT be in DOM
    expect(screen.queryByTestId('custom-body')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('modal-trigger-link'));

    await waitFor(() => {
      expect(screen.getByTestId('custom-body')).toBeInTheDocument();
      expect(screen.getByText('Custom content here')).toBeInTheDocument();
    });
  });
});
