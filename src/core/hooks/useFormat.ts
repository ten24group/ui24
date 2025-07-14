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
    const formatDate = (date: string | Date | Dayjs | number, type: 'date' | 'time' | 'datetime' ): string => {
        const formatString = formatConfig?.[type];
        return date ? dayjsCustom(date).format(formatString) : '';
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
    const formatBoolean = (value: boolean): string => {
        return value ? formatConfig?.boolean?.true || 'True' : formatConfig?.boolean?.false || 'False';
    }

    return { formatDate, formatBoolean };
};