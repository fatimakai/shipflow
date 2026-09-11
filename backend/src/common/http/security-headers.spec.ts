import { createHelmetOptions, PERMISSIONS_POLICY } from './security-headers';

describe('security headers', () => {
  it('uses a deny-by-default CSP and HSTS in production', () => {
    expect(createHelmetOptions(true)).toMatchObject({
      contentSecurityPolicy: {
        directives: {
          baseUri: ["'none'"],
          defaultSrc: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
      hsts: {
        includeSubDomains: true,
        maxAge: 31536000,
        preload: false,
      },
      referrerPolicy: { policy: 'no-referrer' },
    });
  });

  it('keeps local Swagger usable without weakening production headers', () => {
    expect(createHelmetOptions(false)).toMatchObject({
      contentSecurityPolicy: false,
      hsts: false,
    });
  });

  it('disables browser capabilities that the API never needs', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=()');
    expect(PERMISSIONS_POLICY).toContain('geolocation=()');
    expect(PERMISSIONS_POLICY).toContain('payment=()');
  });
});
