import { useUi24Config } from "../context";
import { Dayjs } from 'dayjs';
import { dayjsCustom } from "../dayjs";

export const useFormat = () => {
    const { selectConfig } = useUi24Config();
    const formatConfig = selectConfig((config) => config.formatConfig);

    /**
     * Formats a date using a specified format string.
     * @param {Date} date - The date to format.
     * @param {string} type - The format-type to use.
     * @returns {string} The formatted date.
     */
    const formatDate = (date: string | Date | Dayjs | number, type: 'date' | 'time' | 'datetime' = 'datetime', timezone: string = 'UTC'): string => {
        try {
            // Return empty string for null, undefined, or empty values
            if (date === null || date === undefined || date === '') {
                return date as any;
            }

            const formatString = formatConfig?.[ type ];
            const dayjsDate = dayjsCustom.tz(date, timezone);

            // If invalid date, return original value (don't hide the data)
            if (!dayjsDate.isValid()) {
                console.error('[useFormat] Invalid date detected:', {
                    value: date,
                    valueType: typeof date,
                    timezone,
                    formatType: type,
                    stack: new Error().stack
                });
                return date as any;
            }

            return dayjsDate.format(formatString);
        } catch (error) {
            console.error('[useFormat] Error formatting date:', error, {
                value: date,
                valueType: typeof date,
                timezone,
                formatType: type
            });
            return error.message;
        }
    }

    /**
     *  Formats a boolean value to a string.
     * @param value - The boolean value to format.
     * @returns The formatted boolean value.
     * 
     * @example
     * ```ts
     * formatBoolean(true); // returns "YES"
     * ```
     */
    const formatBoolean = (value: unknown): string => {
        // IMPORTANT: Treat null/undefined as "no value" (not false).
        // The Details view sometimes formats booleans even when backend omits the field,
        // and we must not render "False" for missing data (e.g., audit success is often undefined).
        if (value === null || value === undefined) return value as any;

        // Strict boolean
        if (typeof value === 'boolean') {
            return value ? (formatConfig?.boolean?.true || 'True') : (formatConfig?.boolean?.false || 'False');
        }

        // Common coercions (strings/numbers) for resilience
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (v === 'true' || v === 'yes' || v === '1') return formatConfig?.boolean?.true || 'True';
            if (v === 'false' || v === 'no' || v === '0') return formatConfig?.boolean?.false || 'False';
            return value as any;
        }

        if (typeof value === 'number') {
            if (value === 1) return formatConfig?.boolean?.true || 'True';
            if (value === 0) return formatConfig?.boolean?.false || 'False';
            return value as any;
        }

        return value as any;
    }

    return { formatDate, formatBoolean };
};