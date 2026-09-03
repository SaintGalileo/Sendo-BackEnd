import { Request } from 'express';

export type ClientRequestMeta = {
    ip: string | null;
    userAgent: string;
    device: string;
};

function firstForwardedIp(value: string | string[] | undefined): string | null {
    if (!value) return null;
    const raw = Array.isArray(value) ? value[0] : value;
    const first = String(raw).split(',')[0]?.trim();
    return first || null;
}

export function summarizeUserAgent(userAgent: string): string {
    const ua = String(userAgent || '').trim();
    if (!ua) return 'Unknown device';

    let os = 'Unknown OS';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';

    let browser = 'Unknown browser';
    if (/edg\//i.test(ua)) browser = 'Edge';
    else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
    else if (/chrome|crios/i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) browser = 'Safari';

    return `${browser} on ${os}`;
}

export function clientMetaFromRequest(req: Request): ClientRequestMeta {
    const userAgent = String(req.headers['user-agent'] || '');
    const ip =
        firstForwardedIp(req.headers['x-forwarded-for']) ||
        firstForwardedIp(req.headers['x-real-ip']) ||
        req.socket?.remoteAddress ||
        null;

    return {
        ip,
        userAgent,
        device: summarizeUserAgent(userAgent),
    };
}
