import { URL as NodeURL } from 'url';

export const resolveUrl = (baseUrl: string, relativeUrl: string | null) => {
    if (!relativeUrl) {
        return relativeUrl;
    }
    try {
        return new NodeURL(relativeUrl, baseUrl).toString();
    } catch {
        return relativeUrl;
    }
};