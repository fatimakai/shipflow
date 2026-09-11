import {
  EnvironmentVariables,
  environmentValidationSchema,
} from './env.validation';

describe('environmentValidationSchema', () => {
  const databaseUrl =
    'postgresql://shipflow:shipflow_local_password@localhost:5432/shipflow?schema=public';
  const jwtSecret = 'a-production-jwt-secret-that-is-at-least-32-characters';
  const twoFactorEncryptionKey = Buffer.alloc(32, 19).toString('base64');
  const productionEmail = {
    EMAIL_PROVIDER: 'resend',
    EMAIL_FROM_ADDRESS: 'no-reply@mail.example.com',
    EMAIL_REPLY_TO: 'support@example.com',
    EMAIL_SUPPORT_ADDRESS: 'support@example.com',
    FRONTEND_URL: 'https://app.example.com',
    RESEND_API_KEY: 're_production_key',
    RESEND_WEBHOOK_SECRET: 'whsec_production_secret',
  };
  const productionBilling = {
    BILLING_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_live_production_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_stripe_production_secret',
    STRIPE_PRO_PRODUCT_ID: 'prod_production',
    STRIPE_PRO_MONTHLY_PRICE_ID: 'price_production_monthly',
    STRIPE_PRO_ANNUAL_PRICE_ID: 'price_production_annual',
    STRIPE_AUTOMATIC_TAX_ENABLED: true,
  };
  const productionStorage = {
    FILE_STORAGE_PROVIDER: 's3',
    FILE_MALWARE_SCAN_ENABLED: true,
    AWS_REGION: 'us-east-1',
    S3_BUCKET: 'shipflow-production-files',
  };

  it('coerces values and normalizes a comma-separated CORS allowlist', () => {
    const result = environmentValidationSchema.validate({
      NODE_ENV: 'development',
      PORT: '4000',
      APP_NAME: 'ShipFlow API',
      CORS_ORIGINS: 'http://localhost:5173/, https://app.example.com',
      SWAGGER_ENABLED: 'true',
      DATABASE_URL: databaseUrl,
      DATABASE_POOL_MAX: '20',
      DATABASE_CONNECTION_TIMEOUT_MS: '2500',
    });
    const value = result.value as EnvironmentVariables;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      PORT: 4000,
      LOG_LEVEL: 'debug',
      CORS_ORIGINS: 'http://localhost:5173,https://app.example.com',
      SWAGGER_ENABLED: true,
      HTTP_BODY_LIMIT_BYTES: 1024 * 1024,
      HTTP_REQUEST_TIMEOUT_MS: 30000,
      HTTP_TRUST_PROXY_HOPS: 0,
      RATE_LIMIT_MAX: 120,
      DATABASE_POOL_MAX: 20,
      DATABASE_CONNECTION_TIMEOUT_MS: 2500,
      DATABASE_STATEMENT_TIMEOUT_MS: 15000,
      DATABASE_SLOW_QUERY_MS: 500,
    });
  });

  it('rejects CORS entries that are not HTTP origins', () => {
    const { error } = environmentValidationSchema.validate({
      CORS_ORIGINS: 'https://app.example.com/path',
      DATABASE_URL: databaseUrl,
    });

    expect(error?.message).toContain('CORS_ORIGINS');
  });

  it('disables Swagger by default in production', () => {
    const result = environmentValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      JWT_ACCESS_SECRET: jwtSecret,
      ...productionEmail,
      ...productionBilling,
      ...productionStorage,
      TWO_FACTOR_ENCRYPTION_KEY: twoFactorEncryptionKey,
    });
    const value = result.value as EnvironmentVariables;

    expect(result.error).toBeUndefined();
    expect(value.SWAGGER_ENABLED).toBe(false);
  });

  it('requires a PostgreSQL connection URL', () => {
    const { error } = environmentValidationSchema.validate({
      DATABASE_URL: 'https://example.com/database',
    });

    expect(error?.message).toContain('DATABASE_URL');
  });

  it('rejects unsafe HTTP and database timeout values', () => {
    const { error } = environmentValidationSchema.validate(
      {
        DATABASE_URL: databaseUrl,
        HTTP_BODY_LIMIT_BYTES: 100,
        HTTP_TRUST_PROXY_HOPS: 20,
        DATABASE_STATEMENT_TIMEOUT_MS: 100,
      },
      { abortEarly: false },
    );

    expect(error?.message).toContain('HTTP_BODY_LIMIT_BYTES');
    expect(error?.message).toContain('HTTP_TRUST_PROXY_HOPS');
    expect(error?.message).toContain('DATABASE_STATEMENT_TIMEOUT_MS');
  });

  it('requires a strong explicit JWT secret in production', () => {
    const { error } = environmentValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      JWT_ACCESS_SECRET: 'too-short',
    });

    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('defaults 2FA settings locally and requires a 32-byte key in production', () => {
    const development = environmentValidationSchema.validate({
      DATABASE_URL: databaseUrl,
    });
    const missingProductionKey = environmentValidationSchema.validate({
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      JWT_ACCESS_SECRET: jwtSecret,
      ...productionEmail,
      ...productionBilling,
      ...productionStorage,
    });
    const malformedKey = environmentValidationSchema.validate({
      DATABASE_URL: databaseUrl,
      TWO_FACTOR_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
    });

    expect(development.error).toBeUndefined();
    expect(development.value).toMatchObject({
      TWO_FACTOR_ISSUER: 'ShipFlow',
      TWO_FACTOR_ENCRYPTION_KEY_VERSION: 1,
    });
    expect(
      Buffer.from(
        (development.value as EnvironmentVariables).TWO_FACTOR_ENCRYPTION_KEY,
        'base64',
      ),
    ).toHaveLength(32);
    expect(missingProductionKey.error?.message).toContain(
      'TWO_FACTOR_ENCRYPTION_KEY',
    );
    expect(malformedKey.error?.message).toContain('TWO_FACTOR_ENCRYPTION_KEY');
  });

  it('requires Resend and HTTPS account links in production', () => {
    const { error } = environmentValidationSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtSecret,
        EMAIL_PROVIDER: 'log',
        FRONTEND_URL: 'http://app.example.com',
      },
      { abortEarly: false },
    );

    expect(error?.message).toContain('FRONTEND_URL');
    expect(error?.message).toContain('EMAIL_PROVIDER');
  });

  it('uses the capture adapter by default in tests', () => {
    const result = environmentValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
    });

    expect(result.error).toBeUndefined();
    expect((result.value as EnvironmentVariables).EMAIL_PROVIDER).toBe(
      'capture',
    );
    expect((result.value as EnvironmentVariables).FILE_STORAGE_PROVIDER).toBe(
      'local',
    );
  });

  it('requires Stripe credentials, prices, and automatic tax in production', () => {
    const { error } = environmentValidationSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtSecret,
        ...productionEmail,
        BILLING_PROVIDER: 'stub',
        STRIPE_AUTOMATIC_TAX_ENABLED: false,
      },
      { abortEarly: false },
    );

    expect(error?.message).toContain('BILLING_PROVIDER');
    expect(error?.message).toContain('STRIPE_AUTOMATIC_TAX_ENABLED');
  });

  it('requires explicit sender and support addresses in production', () => {
    const { error } = environmentValidationSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtSecret,
        EMAIL_PROVIDER: 'resend',
        FRONTEND_URL: 'https://app.example.com',
        RESEND_API_KEY: 're_production_key',
        RESEND_WEBHOOK_SECRET: 'whsec_production_secret',
        ...productionStorage,
      },
      { abortEarly: false },
    );

    expect(error?.message).toContain('EMAIL_FROM_ADDRESS');
    expect(error?.message).toContain('EMAIL_REPLY_TO');
    expect(error?.message).toContain('EMAIL_SUPPORT_ADDRESS');
  });

  it('requires S3 and malware scanning in production', () => {
    const localResult = environmentValidationSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtSecret,
        ...productionEmail,
        ...productionBilling,
        FILE_STORAGE_PROVIDER: 'local',
        FILE_MALWARE_SCAN_ENABLED: false,
      },
      { abortEarly: false },
    );

    expect(localResult.error?.message).toContain('FILE_STORAGE_PROVIDER');

    const scanningResult = environmentValidationSchema.validate(
      {
        NODE_ENV: 'production',
        DATABASE_URL: databaseUrl,
        JWT_ACCESS_SECRET: jwtSecret,
        ...productionEmail,
        ...productionBilling,
        FILE_STORAGE_PROVIDER: 's3',
        FILE_MALWARE_SCAN_ENABLED: false,
        AWS_REGION: 'us-east-1',
        S3_BUCKET: 'shipflow-production-files',
      },
      { abortEarly: false },
    );
    expect(scanningResult.error?.message).toContain(
      'FILE_MALWARE_SCAN_ENABLED',
    );
  });

  it('requires OAuth client IDs and secrets in pairs', () => {
    const { error } = environmentValidationSchema.validate({
      DATABASE_URL: databaseUrl,
      GOOGLE_CLIENT_ID: 'google-client-id',
    });

    expect(error?.message).toContain('GOOGLE_CLIENT_SECRET');
  });
});
