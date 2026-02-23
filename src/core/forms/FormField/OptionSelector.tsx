import React, { useCallback, useMemo, useState } from 'react';
import { Select as AntSelect, Radio, Checkbox, Divider, Space, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { OpenInModal, IModalConfig } from '../../../modal/Modal';
import { useEntityConfig, type IEntityConfigReference } from '../../hooks';
import type { IFormField, IOptions, ITemplateConfig, IQuickCreateConfig } from '../../types/field-config';
import { interpolateTemplate } from '../../utils/template';
import { deriveEntityName } from '../../utils';
import { useInfiniteFieldOptions } from '../../query/useFieldOptions';

/**
 * Configuration for API-loaded options in form field selectors.
 * Supports fw24's cursor-based pagination and remote search patterns.
 * 
 * Features:
 * - Cursor-based pagination with "Load More" button (enabled by default)
 * - Remote search with configurable debouncing (enabled by default)
 * - Frontend search fallback when remote search is disabled
 * - Automatic deduplication by value
 * - Alphabetical sorting by label
 * - Nested field support via optionMapping (e.g., 'team.name')
 * 
 * @example
 * // Basic configuration
 * {
 *   apiMethod: 'GET',
 *   apiUrl: '/api/teams',
 *   responseKey: 'data',
 *   optionMapping: {
 *     label: 'teamName',
 *     value: 'teamId'
 *   }
 * }
 * 
 * @example
 * // With filters and custom settings
 * {
 *   apiMethod: 'GET',
 *   apiUrl: '/api/teams',
 *   responseKey: 'data',
 *   filters: { status: 'active' },
 *   count: 100,
 *   disableSearch: true,
 *   optionMapping: {
 *     label: 'teamName',
 *     value: 'teamId'
 *   }
 * }
 * 
 * @example
 * // With nested fields and template labels
 * {
 *   apiMethod: 'GET',
 *   apiUrl: '/api/players',
 *   responseKey: 'data',
 *   optionMapping: {
 *     label: {
 *       composite: ['name', 'team.name', 'jerseyNumber'],
 *       template: '#{jerseyNumber} {name} ({team.name})'
 *     },
 *     value: 'playerId'
 *   }
 * }
 */
export type IFieldOptionsAPIConfig = {
    /** HTTP method for fetching options */
    apiMethod: 'GET' | 'POST';
    /** API endpoint URL */
    apiUrl: string;
    /** Key in response data that contains the options array */
    responseKey: string;
    /** Additional filters to apply when fetching options (sent in request payload) */
    filters?: Record<string, any>;
    /** 
     * Mapping configuration for label and value fields.
     * - String: Simple field name or nested path (e.g., 'team.name')
     * - ITemplateConfig: Complex template with multiple fields (imported from shared utilities)
     * 
     * @see ITemplateConfig from '../../utils/template' for template structure
     */
    optionMapping?: {
        label: string | ITemplateConfig;
        value: string | ITemplateConfig;
    };
    /** Number of options to fetch per request. @default 50 */
    count?: number;
    /** 
     * Disable cursor-based pagination "Load More" functionality.
     * When false (default), shows "Load More" button when more data is available.
     * @default false (ENABLED by default)
     */
    disableLoadMore?: boolean;
    /** 
     * Disable remote search functionality.
     * When false (default), sends 'search' parameter to backend.
     * When true, falls back to frontend filtering.
     * @default false (ENABLED by default)
     */
    disableSearch?: boolean;
    /** 
     * Debounce delay for remote search in milliseconds.
     * Prevents excessive API calls while user is typing.
     * @default 500
     */
    searchDebounce?: number;
}

export function isFieldOptionsAPIConfig(obj: any): obj is IFieldOptionsAPIConfig {
    return (
        obj &&
        obj.apiMethod &&
        (obj.apiMethod === 'GET' || obj.apiMethod === 'POST') &&
        typeof obj.apiUrl === 'string' &&
        typeof obj.responseKey === 'string'
    );
}

// IOptions is re-exported from field-config.ts for consumers that import from here
export type { IOptions } from '../../types/field-config';

export type IFieldOptions = Array<IOptions> | IFieldOptionsAPIConfig;

interface IOptionSelector {
    options: IFieldOptions
    onOptionChange?: Function,
    fieldType: IFormField['fieldType'],
    addNewOption?: IModalConfig, // DEPRECATED: Use addNewOptionConfig instead
    addNewOptionConfig?: IEntityConfigReference, // NEW: Entity config reference
    value?: string,
    placeholder?: string;
    /** Additional filters from parent field dependencies (e.g., country → state cascading) */
    dependencyFilters?: Record<string, unknown>;
    /**
     * Quick-create UX enhancement (#44). Requires `addNewOptionConfig` to be set.
     * When `enabled`, shows a contextual "+ Create '[term]'" button inside the dropdown
     * whenever the search term returns no results. Opens the entity's full create form
     * (from `addNewOptionConfig`) pre-filled with the search term via `prefillField`.
     * No manual field definitions — the entity's own form handles everything.
     */
    quickCreate?: IQuickCreateConfig;
}

/**
 * OptionSelector - A versatile form field component for select, multi-select, radio, and checkbox inputs.
 * 
 * Features:
 * - **Static Options**: Pass an array of options directly
 * - **API-Loaded Options**: Fetch options from backend with cursor-based pagination
 * - **Remote Search**: Search options via backend API with debouncing (500ms default)
 * - **Frontend Search**: Fallback to client-side filtering when remote search is disabled
 * - **Load More**: Infinite scroll pattern with "Load More" button for large datasets
 * - **Deduplication**: Automatically removes duplicate options by value
 * - **Sorting**: Options are alphabetically sorted by label
 * - **Nested Data**: Supports dot notation for nested fields (e.g., 'team.name')
 * - **Add New**: Optional button to create new options via modal
 * - **Template Labels**: Complex labels with multiple fields (e.g., '#12 Player Name (Team)')
 * 
 * API Request Pattern (fw24):
 * ```typescript
 * {
 *   ...filters,           // Base filters
 *   cursor: 'abc123',     // Pagination cursor (omitted on first request)
 *   count: 50,            // Number of records to fetch
 *   search: 'Lakers'      // Search term (when remote search enabled)
 * }
 * ```
 * 
 * API Response Pattern (fw24):
 * ```typescript
 * {
 *   data: [...options],   // Array of option records
 *   cursor: 'xyz789'      // Next page cursor (null/undefined = no more data)
 * }
 * ```
 * 
 * @param options - Static array of options OR API configuration for dynamic loading
 * @param fieldType - Type of selector: 'select', 'multi-select', 'radio', 'checkbox', 'autocomplete'
 * @param onOptionChange - Callback when selection changes
 * @param value - Current selected value(s)
 * @param addNewOption - (DEPRECATED) Legacy modal config for adding new options
 * @param addNewOptionConfig - Entity config reference for adding new options via modal
 * 
 * @example
 * // Static options
 * <OptionSelector
 *   fieldType="select"
 *   options={[
 *     { label: 'Option 1', value: '1' },
 *     { label: 'Option 2', value: '2' }
 *   ]}
 *   onOptionChange={(value) => console.log(value)}
 * />
 * 
 * @example
 * // API-loaded with search and pagination
 * <OptionSelector
 *   fieldType="select"
 *   options={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/teams',
 *     responseKey: 'data',
 *     optionMapping: { label: 'teamName', value: 'teamId' },
 *     count: 50,
 *     disableSearch: false,
 *     disableLoadMore: false
 *   }}
 * />
 * 
 * @example
 * // With nested fields and template labels
 * <OptionSelector
 *   fieldType="select"
 *   options={{
 *     apiMethod: 'GET',
 *     apiUrl: '/api/players',
 *     responseKey: 'data',
 *     optionMapping: {
 *       label: {
 *         composite: ['jerseyNumber', 'name', 'team.name'],
 *         template: '#{jerseyNumber} {name} ({team.name})'
 *       },
 *       value: 'playerId'
 *     }
 *   }}
 * />
 */
export const OptionSelector = ({ 
    options = [], 
    fieldType, 
    addNewOption, 
    addNewOptionConfig,
    quickCreate,
    onOptionChange, 
    value,
    placeholder,
    dependencyFilters,
}: IOptionSelector) => {

    const { resolveConfigRef } = useEntityConfig();
    const [ open, setOpen ] = useState(false);
    // Tracks what the user has typed in the search box — used for the contextual
    // "+ Create '[term]'" quick-create UX when no results are found.
    const [ searchTerm, setSearchTerm ] = useState('');

    const isApiConfig = isFieldOptionsAPIConfig(options);
    const apiConfig = isApiConfig ? (options as IFieldOptionsAPIConfig) : null;

    if (!isApiConfig && !Array.isArray(options) && typeof options === 'object' && options !== null && 'entityName' in options) {
        console.warn(
            `[OptionSelector] Received unresolved RelationEntityOptionConfig for entity "${(options as any).entityName}". ` +
            `This should have been resolved to FieldOptionsAPIConfig during config generation. ` +
            `Check that the entity's service is registered and the relation is properly configured.`
        );
    }

    const optionsEntityName = useMemo(
        () => apiConfig ? deriveEntityName(apiConfig.apiUrl) : 'static',
        [ apiConfig ]
    );

    // Build mapOption callback for transforming raw API records → IOptions
    const mapOption = useCallback((record: any): IOptions => {
        if (!apiConfig?.optionMapping) {
            // Assume record already has label/value
            return record as IOptions;
        }
        const { label: labelMapping, value: valueMapping } = apiConfig.optionMapping;
        return {
            label: typeof labelMapping === 'string'
                ? String(record[labelMapping] ?? '')
                : interpolateTemplate(labelMapping, record),
            value: typeof valueMapping === 'string'
                ? record[valueMapping] ?? ''
                : interpolateTemplate(valueMapping, record),
        };
    }, [ apiConfig?.optionMapping ]);

    // Hook config for useFieldOptions — only meaningful when apiConfig exists
    const hookApiConfig = useMemo(() => {
        if (!apiConfig) return { apiMethod: 'GET' as const, apiUrl: '', responseKey: 'data' };
        return {
            apiMethod: apiConfig.apiMethod,
            apiUrl: apiConfig.apiUrl,
            responseKey: apiConfig.responseKey,
            filters: apiConfig.filters,
            count: apiConfig.count,
            disableSearch: apiConfig.disableSearch,
        };
    }, [ apiConfig ]);

    const isSelectLike = [ 'select', 'multi-select', 'checkbox', 'radio' ].includes(fieldType.toLowerCase());

    const {
        options: apiOptions,
        hasMore,
        isLoading,
        isFetching,
        loadMore,
        search,
        invalidateAll,
    } = useInfiniteFieldOptions({
        entityName: optionsEntityName,
        fieldName: typeof apiConfig?.optionMapping?.value === 'string' ? apiConfig.optionMapping.value : '',
        apiConfig: hookApiConfig,
        dependencyFilters,
        enabled: isApiConfig && isSelectLike,
        mapOption: apiConfig?.optionMapping ? mapOption : undefined,
        searchDebounce: apiConfig?.searchDebounce || 500,
    });

    // Final options: API-loaded (from hook) or static (from props)
    const fieldOptions = isApiConfig ? apiOptions : (Array.isArray(options) ? options : []);
    const loading = isLoading || isFetching;

    // Check if API config has remote search enabled
    const hasRemoteSearch = isApiConfig && apiConfig?.disableSearch !== true;

    // Check if load more is enabled
    const canLoadMore = isApiConfig && apiConfig?.disableLoadMore !== true;

    /**
     * Handle search: delegates to the hook's debounced search for remote,
     * or Ant Design's filterOption for frontend search.
     * Also tracks the raw search term locally for the quick-create UX.
     */
    const handleSearch = useCallback((value: string) => {
        setSearchTerm(value);
        if (hasRemoteSearch) {
            search(value);
        }
        // Frontend search is handled by Ant Design's filterOption
    }, [ hasRemoteSearch, search ]);

    /**
     * Frontend filter function for when remote search is not enabled
     */
    const filterOption = useCallback((input: string, option?: IOptions) => {
        if (!option) return false;

        // If remote search is enabled, don't filter on frontend (backend handles it)
        if (hasRemoteSearch) return true;

        const label = option.label?.toLowerCase() || '';
        const val = String(option.value || '').toLowerCase();
        const term = input.toLowerCase();
        return label.includes(term) || val.includes(term);
    }, [ hasRemoteSearch ]);

    /**
     * Get modal config for "Add New Option" feature
     */
    const getAddNewModalConfig = useCallback((): IModalConfig | null => {
        if (addNewOptionConfig) {
            const resolvedConfig = resolveConfigRef(addNewOptionConfig);

            if (!resolvedConfig) {
                console.warn(
                    `[OptionSelector] Failed to resolve config for addNewOption:`,
                    `${addNewOptionConfig.pageType}-${addNewOptionConfig.entityName}`
                );
                return null;
            }

            if (!resolvedConfig.formPageConfig) {
                console.warn(
                    `[OptionSelector] Resolved config missing formPageConfig:`,
                    `${addNewOptionConfig.pageType}-${addNewOptionConfig.entityName}`,
                    resolvedConfig
                );
                return null;
            }

            return {
                modalType: 'form',
                modalPageConfig: resolvedConfig.formPageConfig
            };
        } else if (addNewOption) {
            return addNewOption;
        }

        return null;
    }, [ addNewOptionConfig, addNewOption, resolveConfigRef ]);

    // Check if add new option should be enabled
    const hasAddNewOption = !!(addNewOptionConfig || addNewOption);

    /**
     * Stable resolved modal config for the "Add Record" / quick-create flow.
     * Memoised separately so it doesn't recompute on every keystroke.
     */
    const addNewModalConfig = useMemo(
        () => getAddNewModalConfig(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ addNewOptionConfig, addNewOption, resolveConfigRef ]
    );

    /**
     * Modal config for the contextual quick-create button (#44).
     * Derived from `addNewModalConfig` with:
     *   - `initialValues` pre-filled with the current search term
     *   - `containerType` set to 'drawer' when `quickCreate.openIn === 'drawer'`
     *
     * Null when quick-create is not active (no search term, no base config, not enabled).
     */
    const quickCreateModalConfig = useMemo((): IModalConfig | null => {
        if (!quickCreate?.enabled || !searchTerm.trim() || !addNewModalConfig) return null;

        // Determine which entity field to pre-fill.
        // Prefer explicit `prefillField`; fall back to the label mapping field.
        const labelField =
            typeof apiConfig?.optionMapping?.label === 'string'
                ? apiConfig.optionMapping.label
                : undefined;
        const prefillField = quickCreate.prefillField ?? labelField;

        return {
            ...addNewModalConfig,
            ...(prefillField
                ? { initialValues: { [prefillField]: searchTerm.trim() } }
                : {}),
            ...(quickCreate.openIn === 'drawer'
                ? { containerType: 'drawer' as const }
                : {}),
        };
    }, [ quickCreate, searchTerm, addNewModalConfig, apiConfig?.optionMapping ]);

    /**
     * Custom dropdown render with "Load More" and "Add Record" footer.
     * The contextual quick-create button is rendered via `notFoundContent`
     * so it appears inline where the "No results" message would normally be.
     */
    const customDropdownRender = useCallback((menu: React.ReactElement) => {
        return (
            <>
                {menu}

                {/* Load More button for cursor-based pagination */}
                {canLoadMore && hasMore && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Button
                            type="link"
                            loading={loading}
                            onClick={loadMore}
                            style={{ width: '100%', textAlign: 'center' }}
                        >
                            Load More
                        </Button>
                    </>
                )}

                {/* Always-visible "Add Record" button — opens the entity's create form */}
                {hasAddNewOption && addNewModalConfig && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Space style={{ padding: '0 8px 4px' }}>
                            <OpenInModal
                                onOpenCallback={() => setOpen(false)}
                                onSuccessCallback={() => invalidateAll()}
                                {...addNewModalConfig}
                                useDynamicIdFromParams={false}
                            >
                                <PlusOutlined /> Add Record
                            </OpenInModal>
                        </Space>
                    </>
                )}
            </>
        );
    }, [ canLoadMore, hasMore, loading, loadMore, hasAddNewOption, addNewModalConfig, invalidateAll ]);

    /**
     * "No results" content for the dropdown.
     * When quick-create is active and the user has typed a search term,
     * replaces the plain "No options found" text with a contextual
     * "+ Create '[term]'" button that opens the entity's create form
     * pre-filled with the search term.
     */
    const notFoundContent = useMemo(() => {
        if (loading) return 'Loading...';
        if (quickCreate?.enabled && searchTerm.trim() && quickCreateModalConfig) {
            return (
                <div style={{ padding: '8px', textAlign: 'center' }}>
                    <OpenInModal
                        onOpenCallback={() => setOpen(false)}
                        onSuccessCallback={() => { setSearchTerm(''); invalidateAll(); }}
                        {...quickCreateModalConfig}
                        useDynamicIdFromParams={false}
                    >
                        <Button type="dashed" size="small" icon={<PlusOutlined />}>
                            Create &ldquo;{searchTerm.trim()}&rdquo;
                        </Button>
                    </OpenInModal>
                </div>
            );
        }
        return 'No options found';
    }, [ loading, quickCreate?.enabled, searchTerm, quickCreateModalConfig, invalidateAll ]);

    return <>
        {fieldType === "checkbox" && (
            <Checkbox.Group 
                value={[ value ]} 
                options={fieldOptions} 
                onChange={(checkedValues) => onOptionChange?.(checkedValues)}
            />
        )}
        
        {fieldType === "radio" && (
            <Radio.Group 
                value={value} 
                options={fieldOptions} 
                onChange={(e) => onOptionChange?.(e.target.value)}
            />
        )}
        
        {fieldType === "select" && (
            <AntSelect 
                value={value} 
                loading={loading}
                showSearch
                filterOption={filterOption}
                onSearch={handleSearch}
                onOpenChange={(visible) => {
                    setOpen(visible);
                    if (!visible) setSearchTerm('');
                }} 
                open={open} 
                options={fieldOptions}
                popupRender={canLoadMore || hasAddNewOption ? customDropdownRender : undefined}
                onChange={(value) => { setSearchTerm(''); onOptionChange?.(value); }}
                notFoundContent={notFoundContent}
                placeholder={placeholder || (hasRemoteSearch ? 'Type to search...' : 'Select an option')}
                style={{ minWidth: 200, width: '100%' }}
                popupMatchSelectWidth={false}
            />
        )}
        
        {fieldType === "multi-select" && (
            <AntSelect 
                value={value}
                loading={loading}
                showSearch
                filterOption={filterOption}
                onSearch={handleSearch}
                onOpenChange={(visible) => {
                    setOpen(visible);
                    if (!visible) setSearchTerm('');
                }} 
                open={open} 
                options={fieldOptions}
                popupRender={canLoadMore || hasAddNewOption ? customDropdownRender : undefined}
                onChange={(value) => { setSearchTerm(''); onOptionChange?.(value); }}
                mode='multiple'
                notFoundContent={notFoundContent}
                placeholder={placeholder || (hasRemoteSearch ? 'Type to search...' : 'Select options')}
                style={{ minWidth: 200, width: '100%' }}
                popupMatchSelectWidth={false}
            />
        )}
    </>
}