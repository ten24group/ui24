/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for the Details component rendering.
 * 
 * Tests that field configurations produce the correct DOM output when
 * given pre-loaded data (dataSource). This bypasses the API layer
 * and focuses purely on the config → DOM rendering pipeline.
 * 
 * Verifies:
 * - Text fields render their values
 * - Boolean fields are formatted correctly (YES/NO)
 * - Missing/null fields are handled gracefully
 * - Numeric fields render correctly (including zero)
 * - Field labels render correctly
 * - Visibility conditions hide/show fields
 * - dataSource bypasses API calls
 * - onDataChange callback fires with record data
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock heavy dependencies (ESM modules) ──
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

import { Details } from '../../detail/Details';
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
// BASIC FIELD RENDERING
// ============================================================================

describe('Details - field rendering from config', () => {
  it('renders text field values from dataSource', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'teamName', label: 'Team Name', column: 'teamName', fieldType: 'text' },
            { name: 'city', label: 'City', column: 'city', fieldType: 'text' },
          ]}
          dataSource={{ teamName: 'Lakers', city: 'Los Angeles' }}
        />
      </TestWrapper>
    );

    // Wait for rendering
    await waitFor(() => {
      expect(screen.getByText('Lakers')).toBeInTheDocument();
    });

    expect(screen.getByText('Los Angeles')).toBeInTheDocument();
  });

  it('renders field labels from config', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'teamName', label: 'Team Name', column: 'teamName', fieldType: 'text' },
          ]}
          dataSource={{ teamName: 'Lakers' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Name')).toBeInTheDocument();
    });
  });

  it('renders boolean fields with format config (YES/NO)', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'isActive', label: 'Active', column: 'isActive', fieldType: 'boolean' },
          ]}
          dataSource={{ isActive: true }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('YES')).toBeInTheDocument();
    });
  });

  it('renders all configured fields from dataSource', async () => {
    const fields = [
      { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
      { name: 'email', label: 'Email', column: 'email', fieldType: 'text' },
      { name: 'phone', label: 'Phone', column: 'phone', fieldType: 'text' },
    ] as any;

    render(
      <TestWrapper>
        <Details
          propertiesConfig={fields}
          dataSource={{ name: 'John', email: 'john@test.com', phone: '555-1234' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('john@test.com')).toBeInTheDocument();
      expect(screen.getByText('555-1234')).toBeInTheDocument();
    });
  });

  it('handles empty/null field values gracefully', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
            { name: 'description', label: 'Description', column: 'description', fieldType: 'text' },
          ]}
          dataSource={{ name: 'Test', description: null }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    // Should render labels even for null values
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('renders numeric values correctly', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'score', label: 'Score', column: 'score', fieldType: 'number' },
            { name: 'count', label: 'Count', column: 'count', fieldType: 'text' },
          ]}
          dataSource={{ score: 42, count: 0 }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

// ============================================================================
// VISIBILITY CONDITIONS
// ============================================================================

describe('Details - visibility conditions', () => {
  it('hides fields with visibility: false', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
            { name: 'secret', label: 'Secret', column: 'secret', fieldType: 'text', visibility: false },
          ]}
          dataSource={{ name: 'Visible', secret: 'Hidden Value' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Visible')).toBeInTheDocument();
    });

    // Secret field should not be visible
    expect(screen.queryByText('Hidden Value')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('shows fields with visibility: true', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text', visibility: true },
          ]}
          dataSource={{ name: 'Visible' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Visible')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// PRE-LOADED DATA (dataSource)
// ============================================================================

describe('Details - display overrides (kind: visibility / format / @channel)', () => {
  it('hides a field when the override entry resolves kind: "visibility" with visible: false', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
            {
              name: 'secret',
              label: 'Secret',
              column: 'secret',
              fieldType: 'text',
              displayOverride: { path: 'secret' },
            },
          ] as any}
          dataSource={{
            name: 'Visible',
            secret: 'Should be hidden',
            overrides: { secret: { kind: 'visibility', visible: false } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Visible')).toBeInTheDocument();
    });

    expect(screen.queryByText('Should be hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('keeps showing a field when kind: "visibility" resolves visible: true', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            {
              name: 'nickname',
              label: 'Nickname',
              column: 'nickname',
              fieldType: 'text',
              displayOverride: { path: 'nickname' },
            },
          ] as any}
          dataSource={{
            nickname: 'Ace',
            overrides: { nickname: { kind: 'visibility', visible: true } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Ace')).toBeInTheDocument();
    });
    expect(screen.getByText('Nickname')).toBeInTheDocument();
  });

  it('applies kind: "format" as a {value} template, changing the rendered text', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            {
              name: 'price',
              label: 'Price',
              column: 'price',
              fieldType: 'text',
              displayOverride: { path: 'price' },
            },
          ] as any}
          dataSource={{
            price: '42',
            overrides: { price: { kind: 'format', value: '{value} USD' } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('42 USD')).toBeInTheDocument();
    });
    expect(screen.queryByText('42')).not.toBeInTheDocument();
  });

  it('applies a format entry keyed for the admin channel (fieldPath@admin)', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            {
              name: 'price',
              label: 'Price',
              column: 'price',
              fieldType: 'text',
              displayOverride: { path: 'price' },
            },
          ] as any}
          dataSource={{
            price: '42',
            overrides: { 'price@admin': { kind: 'format', value: '{value} USD' } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('42 USD')).toBeInTheDocument();
    });
  });

  it('does not apply an entry scoped to a different channel (fieldPath@public)', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            {
              name: 'price',
              label: 'Price',
              column: 'price',
              fieldType: 'text',
              displayOverride: { path: 'price' },
            },
          ] as any}
          dataSource={{
            price: '42',
            overrides: { 'price@public': { kind: 'format', value: '{value} USD' } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    // ui24's admin Details view resolves the 'admin' channel — an entry keyed for a
    // different channel (@public) must not apply here; the raw stored value renders instead.
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.queryByText('42 USD')).not.toBeInTheDocument();
  });

  it('a kind: "value" override still applies (regression guard for the existing behavior)', async () => {
    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            {
              name: 'logo',
              label: 'Logo',
              column: 'logo',
              fieldType: 'text',
              displayOverride: { path: 'logo' },
            },
          ] as any}
          dataSource={{
            logo: 'synced-name',
            overrides: { logo: { kind: 'value', value: 'admin-set-name' } },
          }}
          displayOverrides={{ storageAttribute: 'overrides' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('admin-set-name')).toBeInTheDocument();
    });
    expect(screen.queryByText('synced-name')).not.toBeInTheDocument();
  });
});

describe('Details - dataSource handling', () => {
  it('uses dataSource and does not call API', async () => {
    const mockCallApi = jest.fn();
    jest.spyOn(require('../../core/context/ApiContext'), 'useApi').mockReturnValue({
      callApiMethod: mockCallApi,
    });

    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
          ]}
          dataSource={{ name: 'Pre-loaded Data' }}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Pre-loaded Data')).toBeInTheDocument();
    });

    // API should not be called when dataSource is provided
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  it('calls onDataChange with record when dataSource is provided', async () => {
    const onDataChange = jest.fn();

    render(
      <TestWrapper>
        <Details
          propertiesConfig={[
            { name: 'name', label: 'Name', column: 'name', fieldType: 'text' },
          ]}
          dataSource={{ name: 'Test Team', id: '123' }}
          onDataChange={onDataChange}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });

    // onDataChange should have been called with the record
    expect(onDataChange).toHaveBeenCalledWith(
      expect.objectContaining({ record: expect.objectContaining({ name: 'Test Team' }) })
    );
  });
});
