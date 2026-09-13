/**
 * Customer-facing product price = vendor base price + surge_percentage from utility.
 * Extras/add-ons are not surged.
 */
export function computeProductSurgePrice(basePrice: number, surgePercentage: number): number {
    const price = Math.max(0, Number(basePrice) || 0);
    const pct = Math.min(100, Math.max(0, Number(surgePercentage) || 0));
    return Math.round(price * (1 + pct / 100) * 100) / 100;
}
