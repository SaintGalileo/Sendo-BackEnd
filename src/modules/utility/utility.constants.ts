export const CONTACT_KEYS = ['whatsapp_number', 'call_line'] as const;
export const SURGE_KEYS = ['surge_price', 'surge_percentage'] as const;

export const UTILITY_KEYS = [...CONTACT_KEYS, ...SURGE_KEYS] as const;

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
