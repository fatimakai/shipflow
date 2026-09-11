import type { HelmetOptions } from 'helmet';

export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

export function createHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            baseUri: ["'none'"],
            defaultSrc: ["'none'"],
            formAction: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    frameguard: { action: 'deny' },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    referrerPolicy: { policy: 'no-referrer' },
  };
}
