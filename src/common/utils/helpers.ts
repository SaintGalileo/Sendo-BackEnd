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
    // Handle both 'is_online' boolean and 'status' string formats consistently
    if (merchant.is_online === false) return false;
    if (merchant.status && ['offline', 'closed', 'busy'].includes(merchant.status.toLowerCase())) {
        // 'busy' might still mean they are technically 'online' for discovery but not 'available' for new orders.
        // For now, we treat 'busy' as unavailable for the 'online' badge clarity.
        return false;
    }

    const now = new Date();

    // 2. Active Days Check
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDayName = dayNames[now.getDay()];

    if (merchant.active_days && Array.isArray(merchant.active_days) && merchant.active_days.length > 0) {
        // Ensure case-insensitive comparison
        const isActiveDay = merchant.active_days.some((day: string) => 
            day.trim().toLowerCase() === currentDayName.toLowerCase()
        );
        if (!isActiveDay) return false;
    }

    // 3. Operating Hours Check
    if (!merchant.opening_time || !merchant.closing_time) return true; // Assume 24/7 if not set

    // Normalize time format to HH:mm:ss for comparison
    const normalizeTime = (timeStr: string) => {
        const parts = timeStr.split(':');
        if (parts.length === 2) return `${timeStr.padStart(5, '0')}:00`;
        return timeStr.padStart(8, '0');
    };

    const currentTimeString = now.toTimeString().split(' ')[0]; // "HH:mm:ss"
    const openingTime = normalizeTime(merchant.opening_time);
    const closingTime = normalizeTime(merchant.closing_time);

    // Handle overnight hours (e.g., Opening 22:00 to Closing 04:00)
    if (openingTime > closingTime) {
        return currentTimeString >= openingTime || currentTimeString < closingTime;
    }

    return currentTimeString >= openingTime && currentTimeString < closingTime;
};
