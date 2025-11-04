import React, { useEffect, useState, useRef } from 'react';
import { Select as AntSelect, Radio, Checkbox, Divider, Space, Button } from 'antd';
import { useApi } from '../../context';
import { PlusOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { OpenInModal, IModalConfig } from '../../../modal/Modal';
import { useEntityConfig, type IEntityConfigReference } from '../../hooks';
import type { IFormField } from '../../types/field-config';
import { handleApiError } from '../../utils/api-error-handler';
import { useAppContext } from '../../context/AppContext';
import { interpolateTemplate, parseSimpleTemplate, type ITemplateConfig } from '../../utils/template';

/**
 * @deprecated Use ITemplateConfig from '../../utils/template' instead.
 * Kept for backward compatibility.
 */
export type IAttributesTemplate = ITemplateConfig;

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

export interface IOptions {
    label: string;
    value: string | number;
}

export type IFieldOptions = Array<IOptions> | IFieldOptionsAPIConfig;

interface IOptionSelector {
    options: IFieldOptions
    onOptionChange?: Function,
    fieldType: IFormField['fieldType'],
    addNewOption?: IModalConfig, // DEPRECATED: Use addNewOptionConfig instead
    addNewOptionConfig?: IEntityConfigReference, // NEW: Entity config reference
    value?: string,
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
    onOptionChange, 
    value 
}: IOptionSelector) => {

    const { callApiMethod } = useApi()
    const { resolveConfigRef } = useEntityConfig()
    const { notifyError } = useAppContext()
    const [ open, setOpen ] = useState(false);
    const [ loading, setLoading ] = useState<boolean>(false);
    
    // Options state
    const [ fieldOptions, setFieldOptions ] = useState<Array<IOptions>>(Array.isArray(options) ? options : []);
    const [ cursor, setCursor ] = useState<string>('');
    const [ hasMore, setHasMore ] = useState<boolean>(false);
    
    // Search state
    const [ searchTerm, setSearchTerm ] = useState<string>('');
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    /**
     * Fetch options from API - follows fw24 patterns
     * @param config - API configuration
     * @param search - Search term for remote search
     * @param loadMore - Whether to append (load more) or replace options
     */
    const fetchFieldOptions = async (
        config: IFieldOptionsAPIConfig, 
        search: string = '',
        loadMore: boolean = false
    ): Promise<void> => {
        setLoading(true);
        try {
            const count = config.count || 50;
            const payload: Record<string, any> = { ...(config.filters || {}) };
            
            // fw24 patterns:
            // - cursor: for pagination (like DynamoDB)
            // - count: number of records
            // - search: search query
            if (loadMore && cursor) {
                payload.cursor = cursor;
            }
            payload.count = count;
            
            if (config.disableSearch !== true && search) {
                payload.search = search;
            }
            
            const response = await callApiMethod({ 
                apiUrl: config.apiUrl,
                apiMethod: config.apiMethod,
                payload
            });

            if (response.status === 200) {
                const rawOptions = response.data[config.responseKey] as Array<any>;
                
                // Format options
                let formattedOptions: Array<IOptions>;
                if (!config.optionMapping) {
                    formattedOptions = rawOptions;
                } else {
                    formattedOptions = rawOptions.map((option) => ({
                        label: typeof config.optionMapping.label === 'string'
                            ? option[config.optionMapping.label]
                            : interpolateTemplate(config.optionMapping.label, option),
                        value: typeof config.optionMapping.value === 'string'
                            ? option[config.optionMapping.value]
                            : interpolateTemplate(config.optionMapping.value, option),
                    }));
                }

                // Update state
                let updatedOptions: Array<IOptions>;
                if (loadMore) {
                    // Merge with existing options
                    const combined = [...fieldOptions, ...formattedOptions];
                    
                    // Deduplicate by value (use Map to keep last occurrence)
                    const uniqueMap = new Map<string | number, IOptions>();
                    combined.forEach(opt => uniqueMap.set(opt.value, opt));
                    updatedOptions = Array.from(uniqueMap.values());
                } else {
                    updatedOptions = formattedOptions;
                }
                
                // Sort all options by label
                updatedOptions.sort((a, b) => 
                    a.label.toLowerCase().localeCompare(b.label.toLowerCase())
                );
                
                setFieldOptions(updatedOptions);
                
                // Check for more data (fw24 cursor pattern)
                const nextCursor = (response.data as any)?.cursor;
                setCursor(nextCursor || '');
                setHasMore(!!nextCursor);
            } else if (response.status >= 400) {
                const errorResult = handleApiError(response, 'Failed to load options');
                notifyError(errorResult.errorMessage);
            }
        } catch (error: any) {
            const errorResult = handleApiError(error, 'Failed to load options');
            notifyError(errorResult.errorMessage);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Initial fetch of options
     */
    const fetchOptions = async () => {
        if (![ 'select', 'multi-select', 'checkbox', 'radio' ].includes(fieldType.toLowerCase())) {
            return;
        }
        
        if (typeof options === 'object' && isFieldOptionsAPIConfig(options)) {
            setCursor('');
            setSearchTerm('');
            await fetchFieldOptions(options, '', false);
        }
    }
    
    /**
     * Handle search with debouncing for remote search
     */
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        
        if (typeof options === 'object' && isFieldOptionsAPIConfig(options)) {
            const config = options as IFieldOptionsAPIConfig;
            
            // Remote search (debounced)
            if (config.disableSearch !== true) {
                // Clear previous timeout
                if (searchTimeoutRef.current) {
                    clearTimeout(searchTimeoutRef.current);
                }
                
                // Set new timeout
                const debounceMs = config.searchDebounce || 500;
                searchTimeoutRef.current = setTimeout(async () => {
                    setCursor('');
                    await fetchFieldOptions(config, value, false);
                }, debounceMs);
            }
            // Frontend search is handled by Ant Design's filterOption
        }
    }
    
    /**
     * Load more options (fw24 cursor-based pagination)
     */
    const handleLoadMore = async () => {
        if (typeof options === 'object' && isFieldOptionsAPIConfig(options)) {
            const config = options as IFieldOptionsAPIConfig;
            
            if (config.disableLoadMore !== true && hasMore && !loading && cursor) {
                await fetchFieldOptions(config, searchTerm, true);
            }
        }
    }
    
    /**
     * Frontend filter function for when remote search is not enabled
     */
    const filterOption = (input: string, option?: IOptions) => {
        if (!option) return false;
        
        // If remote search is enabled, don't filter on frontend
        if (typeof options === 'object' && isFieldOptionsAPIConfig(options)) {
            const config = options as IFieldOptionsAPIConfig;
            if (config.disableSearch !== true) {
                return true; // Remote search handles filtering
            }
        }
        
        // Frontend filtering
        const label = option.label?.toLowerCase() || '';
        const value = String(option.value || '').toLowerCase();
        const searchTerm = input.toLowerCase();
        
        return label.includes(searchTerm) || value.includes(searchTerm);
    }
    
    /**
     * Cleanup timeout on unmount
     */
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Fetch options when component mounts or options config changes
     */
    useEffect(() => {
        fetchOptions();
    }, [ options ])

    /**
     * Get modal config for "Add New Option" feature
     */
    const getAddNewModalConfig = (): IModalConfig | null => {
        if (addNewOptionConfig) {
            // NEW: Resolve entity config reference
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
            // OLD: Use legacy IModalConfig directly (backward compatibility)
            return addNewOption;
        }
        
        return null;
    }

    // Check if add new option should be enabled
    const hasAddNewOption = !!(addNewOptionConfig || addNewOption);
    
    // Check if API config has remote search enabled
    const hasRemoteSearch = typeof options === 'object' && 
                            isFieldOptionsAPIConfig(options) && 
                            options.disableSearch !== true;
    
    // Check if load more is enabled
    const canLoadMore = typeof options === 'object' && 
                        isFieldOptionsAPIConfig(options) && 
                        options.disableLoadMore !== true;
    
    /**
     * Custom dropdown render with "Load More" button and "Add New" button
     */
    const customDropdownRender = (menu: React.ReactElement) => {
        const modalConfig = getAddNewModalConfig();
        
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
                            onClick={handleLoadMore}
                            style={{ width: '100%', textAlign: 'center' }}
                        >
                            Load More
                        </Button>
                    </>
                )}
                
                {/* Add New Record button */}
                {hasAddNewOption && modalConfig && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Space style={{ padding: '0 8px 4px' }}>
                            <OpenInModal
                                onOpenCallback={() => setOpen(false)}
                                onSuccessCallback={() => { fetchOptions() }}
                                {...modalConfig}
                                useDynamicIdFromParams={false}
                            >
                                <PlusOutlined /> Add Record
                            </OpenInModal>
                        </Space>
                    </>
                )}
            </>
        );
    };

    return <>
        {fieldType === "checkbox" && (
            <Checkbox.Group 
                value={[ value ]} 
                options={fieldOptions} 
            />
        )}
        
        {fieldType === "radio" && (
            <Radio.Group 
                value={[ value ]} 
                options={fieldOptions} 
            />
        )}
        
        {fieldType === "select" && (
            <AntSelect 
                value={value} 
                loading={loading}
                showSearch
                filterOption={filterOption}
                onSearch={handleSearch}
                onOpenChange={(visible) => setOpen(visible)} 
                open={open} 
                options={fieldOptions}
                dropdownRender={canLoadMore || hasAddNewOption ? customDropdownRender : undefined}
                onChange={(value) => onOptionChange?.(value)}
                notFoundContent={loading ? 'Loading...' : 'No options found'}
                placeholder={hasRemoteSearch ? 'Type to search...' : 'Select an option'}
            />
        )}
        
        {fieldType === "multi-select" && (
            <AntSelect 
                value={value}
                loading={loading}
                showSearch
                filterOption={filterOption}
                onSearch={handleSearch}
                onOpenChange={(visible) => setOpen(visible)} 
                open={open} 
                options={fieldOptions}
                dropdownRender={canLoadMore || hasAddNewOption ? customDropdownRender : undefined}
                onChange={(value) => onOptionChange?.(value)}
                mode='multiple'
                notFoundContent={loading ? 'Loading...' : 'No options found'}
                placeholder={hasRemoteSearch ? 'Type to search...' : 'Select options'}
            />
        )}
    </>
}