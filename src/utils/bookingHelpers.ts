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
