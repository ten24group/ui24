import { useCallback } from 'react';
import { useUi24Config } from "../context";
import { Dayjs } from 'dayjs';
import { parseTemporalToUtc, guessBrowserTimeZone, isUtcZoneId } from '../utils/temporal-parse';

function resolveDisplayTimeZone(
    formatConfig: { dateTimeDisplay?: { primaryZone?: 'local' | 'utc' | 'source' } } | undefined,
    sourceZone: string
): string {
    const mode = formatConfig?.dateTimeDisplay?.primaryZone ?? 'local';
    if (mode === 'utc') return 'UTC';
    if (mode === 'source') return sourceZone || 'UTC';
    return guessBrowserTimeZone();
}

export const useFormat = () => {
    const { selectConfig } = useUi24Config();
    const formatConfig = selectConfig((config) => config.formatConfig);

    /**
     * Formats a date using a specified format string.
     *
     * The third argument is the **source** IANA zone for interpreting naive date/time strings
     * from the API. The **display** zone comes from `formatConfig.dateTimeDisplay.primaryZone`
     * (default: browser local).
     *
     * @param date - The date to format.
     * @param type - Maps to formatConfig key (date | time | datetime).
     * @param sourceTimezone - IANA zone for naive values (default 'UTC').
     */
    const formatDate = useCallback((date: string | Date | Dayjs | number | null | undefined, type: 'date' | 'time' | 'datetime' = 'datetime', sourceTimezone: string = 'UTC'): string | null | undefined => {
        try {
            if (date === null || date === undefined || date === '') {
                return date as null | undefined | '';
            }

            const formatString = formatConfig?.[ type ] ?? (
                type === 'date' ? 'YYYY-MM-DD' : type === 'time' ? 'hh:mm A' : 'YYYY-MM-DD hh:mm A'
            );
            const instant = parseTemporalToUtc(date, sourceTimezone);

            if (!instant || !instant.isValid()) {
                console.error('[useFormat] Invalid date detected:', {
                    value: date,
                    valueType: typeof date,
                    sourceTimezone,
                    formatType: type,
                    stack: new Error().stack
                });
                return String(date);
            }

            const displayTz = resolveDisplayTimeZone(formatConfig, sourceTimezone);
            return instant.tz(displayTz).format(formatString);
        } catch (error) {
            console.error('[useFormat] Error formatting date:', error, {
                value: date,
                valueType: typeof date,
                sourceTimezone,
                formatType: type
            });
            return (error as Error).message;
        }
    }, [ formatConfig ]);

    /**
     * Labels for {@link DateTimeZoneChrome}: stored raw value; popover uses 12h where applicable,
     * Original (source IANA), optional UTC row if source is not a UTC zone id, Local (browser IANA).
     */
    const buildTemporalDisplay = useCallback((
        value: unknown,
        kind: 'date' | 'time' | 'datetime',
        sourceTimezone?: string
    ) => {
        const src = sourceTimezone ?? 'UTC';
        const empty = {
            rawPrimary: '—',
            parseOk: false,
            originalFormatted: '',
            originalZone: 'UTC',
            showUtcRow: false,
            showLocalRow: false,
            localFormatted: '',
            utcFormatted: '',
            localZone: guessBrowserTimeZone(),
            ariaLabel: 'Empty',
        };

        if (value === null || value === undefined || value === '') {
            return empty;
        }

        const rawStr = typeof value === 'string' ? value : String(value);
        if (rawStr.trim() === '') {
            return empty;
        }

        const instant = parseTemporalToUtc(value as string | number | Date | Dayjs, src);

        if (!instant || !instant.isValid()) {
            return {
                ...empty,
                rawPrimary: rawStr,
                parseOk: false,
                ariaLabel: rawStr,
            };
        }

        /** Popover: 12-hour where there is a time component (explicit AM/PM). */
        const popoverFmt = kind === 'date'
            ? 'MMM D, YYYY'
            : kind === 'time'
                ? 'hh:mm A'
                : 'MMM D, YYYY hh:mm A';

        const originalFormatted = instant.tz(src).format(popoverFmt);
        const utcFormatted = instant.tz('UTC').format(popoverFmt);
        const localZone = guessBrowserTimeZone();
        const localFormatted = instant.tz(localZone).format(popoverFmt);
        /** Zone id check — not wall-time compare (avoids hiding UTC when source defaults to UTC). */
        const showUtcRow = !isUtcZoneId(src);
        const showLocalRow = localZone !== src;

        const ariaParts = [
            `Stored: ${rawStr}`,
            `Original (${src}): ${originalFormatted}`,
        ];
        if (showUtcRow) ariaParts.push(`UTC: ${utcFormatted}`);
        if (showLocalRow) ariaParts.push(`Local (${localZone}): ${localFormatted}`);
        const ariaLabel = ariaParts.join('. ');

        return {
            rawPrimary: rawStr,
            parseOk: true,
            originalFormatted,
            originalZone: src,
            showUtcRow,
            showLocalRow,
            localFormatted,
            localZone,
            utcFormatted,
            ariaLabel,
        };
    }, []);

    const formatBoolean = useCallback((value: unknown): string | null | undefined => {
        if (value === null || value === undefined) return value as null | undefined;

        if (typeof value === 'boolean') {
            return value ? (formatConfig?.boolean?.true || 'True') : (formatConfig?.boolean?.false || 'False');
        }

        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            if (v === 'true' || v === 'yes' || v === '1') return formatConfig?.boolean?.true || 'True';
            if (v === 'false' || v === 'no' || v === '0') return formatConfig?.boolean?.false || 'False';
            return value;
        }

        if (typeof value === 'number') {
            if (value === 1) return formatConfig?.boolean?.true || 'True';
            if (value === 0) return formatConfig?.boolean?.false || 'False';
            return String(value);
        }

        return String(value);
    }, [ formatConfig ]);

    return { formatDate, formatBoolean, buildTemporalDisplay };
};
