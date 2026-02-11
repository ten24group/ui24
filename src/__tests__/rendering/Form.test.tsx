/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for Form component rendering.
 * 
 * Tests that form field configurations produce correct form elements.
 * Uses Ant Design's Form component under the hood, so we verify that:
 * - Fields render with correct labels
 * - Different field types produce correct input elements (text, number, textarea, boolean)
 * - Submit and cancel buttons render correctly
 * - Visibility conditions hide fields
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

// Mock app-level dependencies
jest.mock('../../modal/Modal', () => ({
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({
    user: { sub: 'test-user', groups: ['admin'], 'cognito:groups': ['admin'] },
    isLoggedIn: true,
    getToken: () => 'mock-token',
  }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({
    callApiMethod: jest.fn().mockResolvedValue({ status: 200, data: {} }),
  }),
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

import { Form } from '../../forms/Form';

// Helper to provide required onSubmit
const noop = jest.fn();
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { AppStaticProvider } from '../../core/context/AppStaticContext';

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
          <TableStateProvider value={{ selectedRecords: [], selectedRowKeys: [], filters: {}, searchQuery: '' }}>
            <FormStateProvider value={{ record: null, formValues: {}, isDirty: false, isValid: true }}>
              <DetailStateProvider value={{ record: null, isLoading: false }}>
                {children}
              </DetailStateProvider>
            </FormStateProvider>
          </TableStateProvider>
        </AppStaticProvider>
      </Ui24ConfigProvider>
    </MemoryRouter>
  );
}

// ============================================================================
// FORM FIELD RENDERING
// ============================================================================

describe('Form - field rendering from config', () => {
  it('renders text field labels', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'teamName', label: 'Team Name', fieldType: 'text' },
            { name: 'city', label: 'City', fieldType: 'text' },
          ] as any}
          formButtons={[{ text: 'Save', action: 'submit' }] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Name')).toBeInTheDocument();
      expect(screen.getByText('City')).toBeInTheDocument();
    });
  });

  it('renders text input elements for text fields', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'teamName', label: 'Team Name', fieldType: 'text' },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });
  });

  it('renders submit button', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'name', label: 'Name', fieldType: 'text' },
          ] as any}
          formButtons={[
            { text: 'Create Team', action: 'submit' },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Create Team')).toBeInTheDocument();
    });
  });

  it('renders cancel button', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'name', label: 'Name', fieldType: 'text' },
          ] as any}
          formButtons={[
            { text: 'Save', action: 'submit' },
            { text: 'Cancel', action: 'cancel', url: '/teams' },
          ] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// VISIBILITY CONDITIONS
// ============================================================================

describe('Form - visibility conditions', () => {
  it('hides fields with visibility: false', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'name', label: 'Name', fieldType: 'text' },
            { name: 'secret', label: 'Secret Field', fieldType: 'text', visibility: false },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    // Secret field should not be visible
    expect(screen.queryByText('Secret Field')).not.toBeInTheDocument();
  });

  it('shows fields with visibility: true', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'name', label: 'Visible Field', fieldType: 'text', visibility: true },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Visible Field')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// MULTIPLE FIELD TYPES
// ============================================================================

describe('Form - field types', () => {
  it('renders number fields', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'score', label: 'Score', fieldType: 'number' },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Score')).toBeInTheDocument();
    });
    // Number input should render
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('renders textarea fields', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'bio', label: 'Bio', fieldType: 'textarea' },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Bio')).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders boolean fields as switch toggle', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'isActive', label: 'Active', fieldType: 'boolean' },
          ] as any}
          formButtons={[]}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    // Ant Design renders boolean fields as Switch (role="switch")
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders multiple fields of different types and each has correct input element', async () => {
    render(
      <TestWrapper>
        <Form
          onSubmit={noop}
          propertiesConfig={[
            { name: 'teamName', label: 'Team Name', fieldType: 'text' },
            { name: 'score', label: 'Score', fieldType: 'number' },
            { name: 'description', label: 'Description', fieldType: 'textarea' },
          ] as any}
          formButtons={[{ text: 'Submit', action: 'submit' }] as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Name')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    // Verify distinct input elements for each type
    // text + textarea produce textbox roles, number produces spinbutton
    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes.length).toBeGreaterThanOrEqual(2); // text input + textarea
    expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // number input
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });
});
