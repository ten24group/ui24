/// <reference types="@testing-library/jest-dom" />
/**
 * Integration tests for RenderFromPageType - the central page routing component.
 * 
 * RenderFromPageType is the single decision point that maps pageType configs
 * to actual page components. Given a pageType and its corresponding config,
 * it must render the correct component.
 * 
 * This tests:
 * - Each built-in page type routes to its correct component
 * - ExtensionRegistry entity overrides take precedence
 * - ExtensionRegistry custom page types work
 * - Invalid/missing page types render appropriate fallback
 * - PostAuthPage renders PageHeader + page content
 * - Children override page content when provided
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Heavy mocking to isolate the routing logic ──
// Mock all page wrapper components so we can verify routing without full rendering
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
  WizardPage: (props: any) => <div data-testid="wizard-page">WizardPage</div>,
}));
jest.mock('../../pages/PostAuth/Accordion/Accordion', () => ({
  Accordion: (props: any) => <div data-testid="accordion-page">Accordion</div>,
}));
jest.mock('../../pages/PostAuth/DashboardPage', () => ({
  DashboardPage: (props: any) => <div data-testid="dashboard-page">DashboardPage</div>,
  __esModule: true,
}));
jest.mock('../../pages/PostAuth/CustomPage', () => ({
  CustomPage: (props: any) => <div data-testid="custom-page">CustomPage: {props.entityName}</div>,
}));
jest.mock('../../pages/PostAuth/PageHeader/PageHeader', () => ({
  PageHeader: () => <div data-testid="page-header">PageHeader</div>,
}));
// Mock ESM-only dependencies (these packages use `import` syntax Jest can't parse)
jest.mock('@blocknote/core', () => ({ BlockNoteEditor: { create: jest.fn() } }));
jest.mock('@blocknote/react', () => ({ useCreateBlockNote: jest.fn() }));
jest.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
jest.mock('jsonpath-plus', () => ({ JSONPath: jest.fn() }));
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => {} }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => {} }));
jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));
// Mock modal depth
jest.mock('../../modal/Modal', () => ({
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
}));
// Mock condition system hooks
jest.mock('../../core/hooks/useResolve', () => ({
  useResolve: (val: any) => val,
}));
// Mock context hooks used by PageStaticProvider
jest.mock('../../core/context/conditionSystemConfig', () => ({
  getConditionSystemConfig: () => ({}),
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({ user: { sub: 'test', groups: [] } }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

import { PostAuthPage, RenderFromPageType } from '../../pages/PostAuth/PostAuthPage';
import { Ui24ConfigProvider } from '../../core/context/UI24Context';
import { ExtensionRegistry } from '../../core/registry/ExtensionRegistry';

// ── Helper wrapper ──
function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <Ui24ConfigProvider initConfig={{
        baseURL: 'https://api.test.com',
        appName: 'Test',
        appLogo: '/logo.png',
        uiConfig: { auth: {}, menu: {}, pages: {}, dashboard: {} },
      }}>
        {children}
      </Ui24ConfigProvider>
    </MemoryRouter>
  );
}

function renderPageType(props: Record<string, any>) {
  return render(
    <Wrapper>
      <RenderFromPageType {...props} />
    </Wrapper>
  );
}

// ============================================================================
// BUILT-IN PAGE TYPE ROUTING
// ============================================================================

describe('RenderFromPageType - page type routing', () => {
  beforeEach(() => {
    ExtensionRegistry.clear();
  });

  it('renders TablePage for pageType="list"', () => {
    renderPageType({
      pageType: 'list',
      listPageConfig: { entityName: 'team', propertiesConfig: [], apiConfig: {} },
    });

    expect(screen.getByTestId('table-page')).toBeInTheDocument();
    expect(screen.getByText(/TablePage: team/)).toBeInTheDocument();
  });

  it('renders FormPage for pageType="form"', () => {
    renderPageType({
      pageType: 'form',
      formPageConfig: { entityName: 'team', propertiesConfig: [] },
    });

    expect(screen.getByTestId('form-page')).toBeInTheDocument();
    expect(screen.getByText(/FormPage: team/)).toBeInTheDocument();
  });

  it('renders DetailPage for pageType="details"', () => {
    renderPageType({
      pageType: 'details',
      detailsPageConfig: { entityName: 'team', propertiesConfig: [] },
    });

    expect(screen.getByTestId('detail-page')).toBeInTheDocument();
    expect(screen.getByText(/DetailPage: team/)).toBeInTheDocument();
  });

  it('renders Accordion for pageType="accordion"', () => {
    renderPageType({
      pageType: 'accordion',
      accordionsPageConfig: {
        panel1: { pageType: 'list', listPageConfig: {} },
      },
    });

    expect(screen.getByTestId('accordion-page')).toBeInTheDocument();
  });

  it('renders DashboardPage for pageType="dashboard"', () => {
    renderPageType({
      pageType: 'dashboard',
      dashboardPageConfig: { widgets: [] },
    });

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('renders WizardPage for pageType="wizard"', () => {
    renderPageType({
      pageType: 'wizard',
      wizardPageConfig: { steps: [] },
    });

    expect(screen.getByTestId('wizard-page')).toBeInTheDocument();
  });

  it('renders CustomPage for pageType="custom"', () => {
    renderPageType({
      pageType: 'custom',
      customPageConfig: { componentKey: 'my-custom-page' },
    });

    expect(screen.getByTestId('custom-page')).toBeInTheDocument();
  });

  it('shows error for custom page without config', () => {
    renderPageType({ pageType: 'custom' });

    expect(screen.getByText(/Custom page configuration is missing/)).toBeInTheDocument();
  });

  it('shows fallback for invalid page type', () => {
    renderPageType({ pageType: 'nonexistent' });

    expect(screen.getByText(/Invalid Page Type/)).toBeInTheDocument();
  });
});

// ============================================================================
// EXTENSION REGISTRY OVERRIDES
// ============================================================================

describe('RenderFromPageType - ExtensionRegistry overrides', () => {
  beforeEach(() => {
    ExtensionRegistry.clear();
  });

  it('uses entity override when registered', () => {
    const CustomGameList = () => <div data-testid="custom-game-list">Custom Game List</div>;

    ExtensionRegistry.registerEntityPage({
      entity: 'game',
      pageType: 'list',
      component: CustomGameList as any,
    });

    renderPageType({
      pageType: 'list',
      listPageConfig: { entityName: 'game', propertiesConfig: [], apiConfig: {} },
    });

    expect(screen.getByTestId('custom-game-list')).toBeInTheDocument();
    expect(screen.queryByTestId('table-page')).not.toBeInTheDocument();
  });

  it('uses custom page type when registered', () => {
    const KanbanBoard = () => <div data-testid="kanban">Kanban Board</div>;

    ExtensionRegistry.registerPageType({
      key: 'kanban',
      component: KanbanBoard as any,
    });

    renderPageType({ pageType: 'kanban' as any });

    expect(screen.getByTestId('kanban')).toBeInTheDocument();
  });

  it('falls back to built-in when no override matches', () => {
    // Register override for different entity
    const CustomGameList = () => <div data-testid="custom-game-list">Custom Game List</div>;
    ExtensionRegistry.registerEntityPage({
      entity: 'game',
      pageType: 'list',
      component: CustomGameList as any,
    });

    // Render for 'team' entity - should use built-in
    renderPageType({
      pageType: 'list',
      listPageConfig: { entityName: 'team', propertiesConfig: [], apiConfig: {} },
    });

    expect(screen.getByTestId('table-page')).toBeInTheDocument();
    expect(screen.queryByTestId('custom-game-list')).not.toBeInTheDocument();
  });
});

// ============================================================================
// PostAuthPage (full component)
// ============================================================================

describe('PostAuthPage', () => {
  beforeEach(() => {
    ExtensionRegistry.clear();
  });

  it('renders PageHeader for dashboard pages', () => {
    render(
      <Wrapper>
        <PostAuthPage
          pageType="dashboard"
          dashboardPageConfig={{ widgets: [] }}
          pageTitle="My Dashboard"
        />
      </Wrapper>
    );

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('renders children instead of page content when provided', () => {
    render(
      <Wrapper>
        <PostAuthPage pageType="dashboard">
          <div data-testid="custom-children">Custom Content</div>
        </PostAuthPage>
      </Wrapper>
    );

    expect(screen.getByTestId('custom-children')).toBeInTheDocument();
    // Should NOT render dashboard page when children are provided
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });
});
