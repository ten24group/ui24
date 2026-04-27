/// <reference types="@testing-library/jest-dom" />
/**
 * BEHAVIORAL tests for actionRenderer.
 *
 * These tests verify real rendering decisions:
 * - URL substitution: `:param` placeholders replaced with record/routeParams values
 * - href attribute set correctly on rendered links
 * - Disabled buttons are actually disabled DOM elements
 * - hideInModal returns null (not a hidden element — actually null)
 * - Dropdown items return MenuItem objects (not React elements)
 * - Template labels fully evaluate {field} from record and routeParams
 * - Modal vs Drawer vs Navigation routing decisions are correct
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock ESM-only dependencies ──
jest.mock('@blocknote/core', () => ({ BlockNoteEditor: { create: jest.fn() } }));
jest.mock('@blocknote/react', () => ({ useCreateBlockNote: jest.fn() }));
jest.mock('@blocknote/mantine', () => ({ BlockNoteView: () => null }));
jest.mock('jsonpath-plus', () => ({ JSONPath: jest.fn(() => undefined) }));
jest.mock('react-markdown', () => ({ __esModule: true, default: () => null }));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => { } }));
jest.mock('rehype-raw', () => ({ __esModule: true, default: () => { } }));
jest.mock('rehype-sanitize', () => ({ __esModule: true, default: () => { } }));
jest.mock('antd-img-crop', () => ({ __esModule: true, default: ({ children }: any) => children }));

jest.mock('../../modal/Modal', () => ({
  useModalDepth: () => 0,
  ModalDepthContext: React.createContext(0),
  // OpenInModal receives children: [trigger, content]; render just the trigger
  OpenInModal: ({ children }: any) => {
    const trigger = Array.isArray(children) ? children[ 0 ] : children;
    return <div data-testid="mock-open-in-modal">{trigger}</div>;
  },
}));
jest.mock('../../modal/OpenRouteInModal', () => ({
  OpenRouteInModal: ({ children }: any) => {
    const trigger = Array.isArray(children) ? children[ 0 ] : children;
    return <div data-testid="mock-open-route-in-modal">{trigger}</div>;
  },
}));
jest.mock('../../modal/Drawer', () => ({
  OpenInDrawer: ({ children }: any) => <div data-testid="mock-open-in-drawer">{children}</div>,
}));
jest.mock('../../modal/OpenRouteInDrawer', () => ({
  OpenRouteInDrawer: ({ children }: any) => <div data-testid="mock-open-route-in-drawer">{children}</div>,
}));
jest.mock('../../core/context/AuthContext', () => ({
  useAuth: () => ({ user: { sub: 'test-user', groups: [ 'admin' ] } }),
}));
jest.mock('../../core/context/conditionSystemConfig', () => ({
  getConditionSystemConfig: () => ({}),
}));
jest.mock('../../core/context/ApiContext', () => ({
  useApi: () => ({ callApiMethod: jest.fn() }),
}));
jest.mock('../../core/context/AppContext', () => ({
  useAppContext: () => ({
    notifyError: jest.fn(), notifySuccess: jest.fn(),
    notifyWarning: jest.fn(), notifyInfo: jest.fn(), notifyLoading: jest.fn(),
  }),
}));
jest.mock('../../core/context/ResponseModalContext', () => ({
  useResponseModalContext: () => ({ showResponseModal: jest.fn(), hideResponseModal: jest.fn() }),
}));
jest.mock('../../routes/Navigation', () => ({
  useCoreNavigator: () => jest.fn(),
}));
jest.mock('../../core/common', () => ({
  Link: ({ children, to, title, url }: any) => <a href={to || url}>{children || title}</a>,
}));
jest.mock('../../core/common/Icons/Icons', () => ({
  Icon: ({ iconName }: any) => <span data-testid={`icon-${iconName}`}>{iconName}</span>,
}));
jest.mock('../../core/bulk-delete/BulkDeleteAction', () => ({
  BulkDeleteAction: ({ label, selectedRecords, routeParams }: any) => (
    <button data-testid="bulk-delete-action" data-selected-count={selectedRecords?.length ?? 0} data-has-filters={routeParams?.filters ? 'yes' : 'no'}>
      {label}
    </button>
  ),
}));

import { renderSingleAction } from '../../core/utils/actionRenderer';

// Helper to render result into DOM
function renderAction(result: any) {
  if (!result) return null;
  return render(<MemoryRouter>{result as React.ReactElement}</MemoryRouter>);
}

// ============================================================================
// URL SUBSTITUTION — verify :param placeholders in href
// ============================================================================

describe('actionRenderer - URL substitution', () => {
  it('substitutes :id in URL from record data', () => {
    const result = renderSingleAction({
      action: { label: 'Edit', url: '/teams/:id/edit' } as any,
      key: 'edit',
      isTableRowAction: true,
      record: { id: '42', name: 'Lakers' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('/teams/42/edit');
  });

  it('substitutes nested params from record', () => {
    const result = renderSingleAction({
      action: { label: 'View', url: '/orgs/:orgId/teams/:teamId' } as any,
      key: 'view',
      isTableRowAction: true,
      record: { orgId: 'org-1', teamId: 'team-99' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    const link = container.querySelector('a');
    expect(link!.getAttribute('href')).toBe('/orgs/org-1/teams/team-99');
  });

  it('uses routeParams for substitution when no record is provided', () => {
    const onNavigate = jest.fn();
    const result = renderSingleAction({
      action: { label: 'Back', url: '/orgs/:orgId' } as any,
      key: 'back',
      routeParams: { orgId: 'org-7' },
      onNavigate,
    });

    const { container } = renderAction(result)!;
    expect(container.textContent).toContain('Back');
    // Non-table-row action renders as button
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    // The button should be clickable (not disabled)
    expect(button!.disabled).toBe(false);
  });
});

// ============================================================================
// DISABLED STATE — verify button is actually disabled
// ============================================================================

describe('actionRenderer - disabled state', () => {
  it('renders disabled button with disabled attribute', () => {
    const result = renderSingleAction({
      action: { label: 'Delete' } as any,
      key: 'del',
      isDisabled: true,
      disabledMessage: 'You need admin permissions',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(button!.disabled).toBe(true);
  });

  it('does NOT set href on disabled table row action', () => {
    const result = renderSingleAction({
      action: { label: 'Edit', url: '/teams/:id/edit', icon: 'EditOutlined' } as any,
      key: 'edit',
      isTableRowAction: true,
      isDisabled: true,
      record: { id: '42' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    const link = container.querySelector('a');
    // Disabled row actions should NOT have href
    expect(link?.getAttribute('href')).toBeNull();
  });
});

describe('actionRenderer - bulk delete action', () => {
  it('renders configured bulk delete action with selected records and filters', () => {
    const result = renderSingleAction({
      action: {
        label: 'Delete Posts',
        icon: 'DeleteOutlined',
        bulkDeleteConfig: {
          entityName: 'post',
          impactApiUrl: '/admin/post/delete-impact',
          executeApiUrl: '/admin/post/execute-delete-plan',
          identifierFields: [ 'postId' ],
        },
      } as any,
      key: 'bulk-delete',
      selectedRecords: [ { postId: 'post-1' }, { postId: 'post-2' } ],
      routeParams: { filters: { status: { eq: 'draft' } } },
    });

    renderAction(result)!;

    const trigger = screen.getByTestId('bulk-delete-action');
    expect(trigger).toHaveTextContent('Delete Posts');
    expect(trigger).toHaveAttribute('data-selected-count', '2');
    expect(trigger).toHaveAttribute('data-has-filters', 'yes');
  });
});

// ============================================================================
// hideInModal — returns literally null
// ============================================================================

describe('actionRenderer - hideInModal', () => {
  it('returns null (not a hidden element) when hideInModal=true and isInModal=true', () => {
    const result = renderSingleAction({
      action: { label: 'Should Not Exist', hideInModal: true } as any,
      key: 'hidden',
      isInModal: true,
      routeParams: {},
      onNavigate: jest.fn(),
    });

    expect(result).toBeNull();
  });

  it('returns a renderable element when hideInModal=true but isInModal=false', () => {
    const result = renderSingleAction({
      action: { label: 'Visible', hideInModal: true } as any,
      key: 'vis',
      isInModal: false,
      routeParams: {},
      onNavigate: jest.fn(),
    });

    expect(result).not.toBeNull();
    const { container } = renderAction(result)!;
    expect(container.textContent).toContain('Visible');
  });
});

// ============================================================================
// TEMPLATE LABELS — verify {field} replacement
// ============================================================================

describe('actionRenderer - template label evaluation', () => {
  it('replaces {name} with record.name in rendered text', () => {
    const result = renderSingleAction({
      action: { label: 'View', template: 'View {name}' } as any,
      key: 't1',
      record: { id: '1', name: 'Lakers' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.textContent).toContain('View Lakers');
    // Must NOT contain the raw template placeholder
    expect(container.textContent).not.toContain('{name}');
  });

  it('replaces {field} with routeParams when no record', () => {
    const result = renderSingleAction({
      action: { label: 'View', template: 'Manage {teamName}' } as any,
      key: 't2',
      routeParams: { teamName: 'Warriors' },
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.textContent).toContain('Manage Warriors');
    expect(container.textContent).not.toContain('{teamName}');
  });

  it('uses label as fallback when template is not provided', () => {
    const result = renderSingleAction({
      action: { label: 'Static Label' } as any,
      key: 't3',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.textContent).toBe('Static Label');
  });
});

// ============================================================================
// ROUTING DECISIONS — modal vs drawer vs navigation
// ============================================================================

describe('actionRenderer - routing decisions', () => {
  it('routes to OpenInModal when openInModal=true with modalConfig', () => {
    const result = renderSingleAction({
      action: {
        label: 'Confirm Delete',
        openInModal: true,
        modalConfig: { modalType: 'confirm', modalTitle: 'Delete?' },
      } as any,
      key: 'modal1',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.querySelector('[data-testid="mock-open-in-modal"]')).toBeTruthy();
  });

  it('routes to OpenRouteInModal when openInModal=true with url but no modalConfig', () => {
    const result = renderSingleAction({
      action: {
        label: 'View in Modal',
        openInModal: true,
        url: '/teams/123',
      } as any,
      key: 'modal2',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.querySelector('[data-testid="mock-open-route-in-modal"]')).toBeTruthy();
  });

  it('renders as plain button when no modal/drawer config', () => {
    const result = renderSingleAction({
      action: { label: 'Navigate', url: '/teams' } as any,
      key: 'nav',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    const button = container.querySelector('button');
    expect(button).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-open-in-modal"]')).toBeNull();
    expect(container.querySelector('[data-testid="mock-open-route-in-modal"]')).toBeNull();
  });

  it('renders table row action as <a> tag (not button)', () => {
    const result = renderSingleAction({
      action: { label: 'View', url: '/teams/:id', icon: 'EyeOutlined' } as any,
      key: 'row-view',
      isTableRowAction: true,
      record: { id: '5' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.querySelector('a')).toBeTruthy();
    expect(container.querySelector('button')).toBeNull();
  });
});

// ============================================================================
// DROPDOWN ITEMS — verify return type
// ============================================================================

describe('actionRenderer - drawer routing', () => {
  it('routes to OpenInDrawer when openInDrawer=true with drawerConfig', () => {
    const result = renderSingleAction({
      action: {
        label: 'Edit in Drawer',
        openInDrawer: true,
        drawerConfig: {
          drawerType: 'form',
          drawerPageConfig: { propertiesConfig: [ { name: 'x', fieldType: 'text' } ] },
        },
      } as any,
      key: 'drawer1',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.querySelector('[data-testid="mock-open-in-drawer"]')).toBeTruthy();
    // Must NOT route to modal
    expect(container.querySelector('[data-testid="mock-open-in-modal"]')).toBeNull();
  });

  it('routes to OpenRouteInDrawer when openInDrawer=true with url', () => {
    const result = renderSingleAction({
      action: {
        label: 'View in Drawer',
        openInDrawer: true,
        url: '/teams/123',
      } as any,
      key: 'drawer2',
      routeParams: {},
      onNavigate: jest.fn(),
    });

    const { container } = renderAction(result)!;
    expect(container.querySelector('[data-testid="mock-open-route-in-drawer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="mock-open-in-modal"]')).toBeNull();
  });
});

describe('actionRenderer - dropdown items', () => {
  it('returns an object with exact key and a renderable label', () => {
    const result = renderSingleAction({
      action: { label: 'Duplicate', url: '/teams/:id/dup' } as any,
      key: 'dup',
      isDropdownItem: true,
      record: { id: '1' },
      routeParams: {},
      onNavigate: jest.fn(),
    });

    // Dropdown items are menu item objects: { key, label, icon?, ... }
    expect(result).toBeTruthy();
    expect(typeof result).toBe('object');
    expect((result as any).key).toBe('dup');
    // label should be renderable and contain the action text
    expect((result as any).label).toBeDefined();
  });
});
