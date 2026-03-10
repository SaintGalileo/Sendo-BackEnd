/**
 * Checks if a merchant is currently available for orders.
 * A merchant is available if:
 * 1. They are manually toggled to 'online' (is_online is true)
 * 2. The current time is within their operating hours.
 * 3. The current day is within their active days.
 * 
 * @param merchant The merchant object from the database
 * @returns boolean
 */
export const isMerchantAvailable = (merchant: any): boolean => {
    // 1. Manual Toggle Check
    // If you don't have a 'status' field yet, we recommend adding 'is_online' (boolean)
    // For now, we'll assume 'is_online' or 'status' might be used.
    if (merchant.is_online === false) return false;
    if (merchant.status === 'offline' || merchant.status === 'closed') return false;

    const now = new Date();

    // 2. Active Days Check
    // Day in JS: 0 (Sun) - 6 (Sat). We assume active_days stores names like "Monday", "Tuesday", etc.
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[now.getDay()];

    if (merchant.active_days && merchant.active_days.length > 0) {
        if (!merchant.active_days.includes(currentDayName)) {
            return false;
        }
    }

    // 3. Operating Hours Check
    if (!merchant.opening_time || !merchant.closing_time) return true; // Assume 24/7 if not set

    const currentTimeString = now.toTimeString().split(' ')[0]; // "HH:mm:ss"

    // Simple string comparison works for "HH:mm" or "HH:mm:ss" formats
    const isAfterOpening = currentTimeString >= merchant.opening_time;
    const isBeforeClosing = currentTimeString <= merchant.closing_time;

    // Handle overnight hours (e.g., 22:00 to 04:00)
    if (merchant.opening_time > merchant.closing_time) {
        return isAfterOpening || isBeforeClosing;
    }

    return isAfterOpening && isBeforeClosing;
};
