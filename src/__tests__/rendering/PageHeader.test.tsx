/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for PageHeader rendering.
 * 
 * Tests that PageHeader correctly renders:
 * - Page titles (static and template-based)
 * - Breadcrumbs with labels and links
 * - Breadcrumb visibility conditions
 * - Action buttons
 * - Template evaluation from routeParams/record data
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock ESM-only dependencies ──
jest.mock('@blocknote/core', () => ({ BlockNoteEditor: { create: jest.fn() } }));
jest.mock('@blocknote/react', () => ({ useCreateBlockNote: jest.fn() }));
jest.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
jest.mock('jsonpath-plus', () => ({ JSONPath: jest.fn() }));
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => {} }));
jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));
jest.mock('../../routes/Navigation', () => ({
  useCoreNavigator: () => jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));
jest.mock('../../core/common', () => ({
  Link: ({ children, to, title, url }: any) => <a href={to || url}>{children || title}</a>,
}));
jest.mock('../../core/common/Icons/Icons', () => ({
  Icon: ({ name }: any) => <span data-testid={`icon-${name}`}>{name}</span>,
}));
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

import { PageHeader } from '../../pages/PostAuth/PageHeader/PageHeader';
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { FormStateProvider } from '../../core/context/FormStateContext';
import { TableStateProvider } from '../../core/context/TableStateContext';
import { DetailStateProvider } from '../../core/context/DetailStateContext';
import { AppStaticProvider } from '../../core/context/AppStaticContext';

// ── Wrapper ──
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Ui24ConfigProvider initConfig={{
        baseURL: 'https://api.test.com',
        appName: 'Test',
        appLogo: '/logo.png',
        uiConfig: { auth: {}, menu: {}, pages: {}, dashboard: {} },
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
// PAGE TITLE
// ============================================================================

describe('PageHeader - page title', () => {
  it('renders static page title', async () => {
    render(
      <Wrapper>
        <PageHeader pageTitle="Team Management" />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Team Management')).toBeInTheDocument();
    });
  });

  it('renders template page title with routeParams', async () => {
    render(
      <Wrapper>
        <PageHeader
          pageTitle="Edit {teamName}"
          routeParams={{ teamName: 'Lakers' }}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Lakers')).toBeInTheDocument();
    });
  });

  it('renders without title — no heading element present', () => {
    const { container } = render(
      <Wrapper>
        <PageHeader />
      </Wrapper>
    );

    // No page title text should render, but the component should exist
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5');
    // Either no headings, or headings with empty/whitespace text
    const nonEmptyHeadings = Array.from(headings).filter(h => h.textContent?.trim());
    expect(nonEmptyHeadings.length).toBe(0);
  });
});

// ============================================================================
// BREADCRUMBS
// ============================================================================

describe('PageHeader - breadcrumbs', () => {
  it('renders breadcrumb labels', async () => {
    render(
      <Wrapper>
        <PageHeader
          breadcrumbs={[
            { label: 'Home', url: '/' },
            { label: 'Teams', url: '/teams' },
            { label: 'Details' },
          ]}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Teams')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });
  });

  it('renders breadcrumb links with correct href values', async () => {
    const { container } = render(
      <Wrapper>
        <PageHeader
          breadcrumbs={[
            { label: 'Home', url: '/' },
            { label: 'Teams', url: '/teams' },
            { label: 'Details' },
          ]}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    // Breadcrumbs with url should render as links with correct href
    const links = container.querySelectorAll('a');
    const linkMap = Array.from(links).reduce((acc, link) => {
      const text = link.textContent?.trim();
      if (text) acc[text] = link.getAttribute('href');
      return acc;
    }, {} as Record<string, string | null>);

    expect(linkMap['Home']).toBe('/');
    expect(linkMap['Teams']).toBe('/teams');
    // "Details" has no url, should NOT be a link
    expect(linkMap['Details']).toBeUndefined();
  });

  it('hides breadcrumbs with visibility: false', async () => {
    render(
      <Wrapper>
        <PageHeader
          breadcrumbs={[
            { label: 'Home', url: '/' },
            { label: 'Admin Only', url: '/admin', visibility: false },
            { label: 'Current' },
          ]}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    // Admin-only breadcrumb should be hidden
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
  });

  it('evaluates template breadcrumb labels', async () => {
    render(
      <Wrapper>
        <PageHeader
          breadcrumbs={[
            { label: 'Home', url: '/' },
            { label: '{teamName}' },
          ]}
          routeParams={{ teamName: 'Lakers' }}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Lakers')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// ACTIONS
// ============================================================================

describe('PageHeader - actions', () => {
  it('renders action buttons', async () => {
    render(
      <Wrapper>
        <PageHeader
          pageHeaderActions={[
            { label: 'Create Team', type: 'button', actionConfig: { apiConfig: { apiMethod: 'POST', apiUrl: '/api/teams' } } } as any,
          ]}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Create Team')).toBeInTheDocument();
    });
  });

  it('hides actions with visibility: false', async () => {
    render(
      <Wrapper>
        <PageHeader
          pageHeaderActions={[
            { label: 'Visible Action', type: 'button' } as any,
            { label: 'Hidden Action', type: 'button', visibility: false } as any,
          ]}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Visible Action')).toBeInTheDocument();
    });

    expect(screen.queryByText('Hidden Action')).not.toBeInTheDocument();
  });

  it('renders append actions alongside main actions', async () => {
    render(
      <Wrapper>
        <PageHeader
          pageHeaderActions={[
            { label: 'Main Action', type: 'button' } as any,
          ]}
          appendActions={<button data-testid="appended">Refresh</button>}
        />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Main Action')).toBeInTheDocument();
      expect(screen.getByTestId('appended')).toBeInTheDocument();
    });
  });
});
