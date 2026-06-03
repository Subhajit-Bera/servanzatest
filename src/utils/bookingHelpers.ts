/**
 * Booking Metadata Helpers
 * 
 * Safely extracts and formats multi-service booking data from the
 * metadata JSON field. Handles both parsed objects and stringified
 * JSON payloads from the API.
 */

export interface BookingItem {
    serviceId: string;
    title: string;
    price: number;
    quantity: number;
    imageUrl?: string;
}

/**
 * Safely extracts booking items from the metadata JSON.
 * Handles both parsed objects and stringified JSON payloads.
 */
export const getBookingItems = (booking: any): BookingItem[] => {
    try {
        const rawMetadata = booking?.metadata;
        if (!rawMetadata) return [];
        if (typeof rawMetadata === 'string') {
            return JSON.parse(rawMetadata).items || [];
        }
        return rawMetadata.items || [];
    } catch (e) {
        console.warn('[bookingHelpers] Failed to parse metadata', e);
        return [];
    }
};

/**
 * Generates a dynamic display title for multi-service master bookings.
 * Falls back to the standard service title for legacy bookings.
 */
export const getDisplayTitle = (booking: any): string => {
    const items = getBookingItems(booking);
    if (items.length > 1) {
        return `${items[0].title} + ${items.length - 1} more`;
    }
    return items[0]?.title || booking?.service?.title || 'Service Booking';
};

/**
 * Returns a privacy-restricted address for buddy display.
 * Shows only streetAddress + postalCode, not the full formatted address.
 */
export const getBuddyAddress = (address: any): string => {
    if (!address) return 'Address';
    const street = address.streetAddress || '';
    const pin = address.postalCode || '';
    if (street && pin) return `${street} - ${pin}`;
    return street || address.formattedAddress || 'Address';
};

/**
 * Calculates the exact job duration in minutes dynamically.
 * Fallbacks from scheduled DB times down to static metadata.
 */
export const getActualJobDuration = (booking: any): number => {
    try {
        // 1. Exact DB scheduled times
        if (booking?.scheduledStart && booking?.scheduledEnd) {
            const start = new Date(booking.scheduledStart).getTime();
            const end = new Date(booking.scheduledEnd).getTime();
            const mins = Math.round((end - start) / 60000);
            if (mins > 0) return mins;
        }

        // 2. Metadata items duration (if mapped)
        const items = getBookingItems(booking);
        if (items.length > 0) {
            let totalMins = 0;
            for (const item of items) {
                const itemDuration = (item as any).durationMins || 0;
                totalMins += itemDuration * (item.quantity || 1);
            }
            if (totalMins > 0) return totalMins;
        }

        // 3. Simple fallbacks
        if (booking?.durationMins) return booking.durationMins;
        if (booking?.service?.durationMins) return booking.service.durationMins;

        return 60; // Absolute fallback
    } catch (e) {
        console.warn('[bookingHelpers] Failed to calculate duration', e);
        return 60;
    }
};
