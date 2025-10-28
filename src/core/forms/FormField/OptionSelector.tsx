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
/**
 * Represents the template for attributes.
 * like
 * ```ts
 * {
 *      composite: ['att1', 'att2'],
 *      template: '{att1}-AND-${att2}' // any arbitrary string with placeholders
 * }
 * ```
*/
export type IAttributesTemplate = {
    composite: Array<string>,
    template: string,
}

function interpolateTemplate(label: IAttributesTemplate, option: any) {
    const { composite, template } = label;
    let interpolatedLabel = template;
    composite.forEach((attribute) => {
        const regex = new RegExp(`{${attribute}}`, "g");
        interpolatedLabel = interpolatedLabel.replace(regex, option[ attribute ]);
    });
    return interpolatedLabel;
}

export type IFieldOptionsAPIConfig = {
    apiMethod: 'GET' | 'POST';
    apiUrl: string;
    responseKey: string;
    /** Additional filters to apply when fetching options */
    filters?: Record<string, any>;
    optionMapping?: {
        label: string | IAttributesTemplate;
        value: string | IAttributesTemplate;
    };
    /** Number of options to fetch per request (default: 50) */
    count?: number;
    /** Disable load more functionality - cursor-based pagination (default: false, meaning load more is ENABLED) */
    disableLoadMore?: boolean;
    /** Disable remote search - sends 'search' parameter to backend (default: false, meaning search is ENABLED) */
    disableSearch?: boolean;
    /** Debounce delay for search in ms (default: 500) */
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