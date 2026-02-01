import { init, trackEvent as aptabaseTrackEvent } from '@aptabase/web';

export const initAnalytics = () => {
    init('A-US-5530417190');
};

export const trackEvent = (eventName: string, props?: Record<string, string | number | boolean>) => {
    try {
        aptabaseTrackEvent(eventName, props);
    } catch (e) {
        console.warn('Analytics Error:', e);
    }
};
