const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts any English digits in a string or number to Persian digits.
 * Returns a dash for null, undefined, or empty string values.
 * @param value The input string or number.
 * @returns A string with Persian digits.
 */
export const toPersianDigits = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return '-';
    return String(value).replace(/[0-9]/g, (digit) => persianDigits[parseInt(digit, 10)]);
};

/**
 * Converts Persian and Arabic digits in a string to English digits.
 * @param value The input string or number.
 * @returns A string with English digits.
 */
export const toEnglishDigits = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    let str = String(value);
    for (let i = 0; i < 10; i++) {
        str = str.replace(new RegExp(persianDigits[i], 'g'), String(i))
                 .replace(new RegExp(arabicDigits[i], 'g'), String(i));
    }
    return str;
};


/**
 * Formats a number as currency with thousand separators and converts to Persian digits.
 * @param value The number to format.
 * @returns A formatted string with Persian digits and commas.
 */
export const formatRial = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    // Use Intl.NumberFormat for robust comma separation.
    const formatted = new Intl.NumberFormat('en-US').format(value);
    return toPersianDigits(formatted);
}