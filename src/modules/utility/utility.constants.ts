export const UTILITY_KEYS = [
    'whatsapp_number',
    'call_line',
    'surge_price',
    'surge_percentage',
] as const;

export type UtilityKey = (typeof UTILITY_KEYS)[number];

export type UtilityMap = Record<UtilityKey, string>;

export const DEFAULT_UTILITY: UtilityMap = {
    whatsapp_number: '',
    call_line: '',
    surge_price: '0',
    surge_percentage: '0',
};

export type SurgeCaps = {
    surge_price: number;
    surge_percentage: number;
};
