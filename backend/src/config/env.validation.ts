import * as Joi from 'joi';

const normalizeCorsOrigins = (
  value: string,
  helpers: Joi.CustomHelpers,
): string | Joi.ErrorReport => {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return helpers.error('any.invalid');
  }

  try {
    return origins
      .map((origin) => {
        const url = new URL(origin);
        const hasOriginOnlyPath = url.pathname === '/' || url.pathname === '';

        if (
          !['http:', 'https:'].includes(url.protocol) ||
          !hasOriginOnlyPath ||
          url.search ||
          url.hash ||
          url.username ||
          url.password
        ) {
          throw new Error('Invalid CORS origin');
        }

        return url.origin;
      })
      .join(',');
  } catch {
    return helpers.error('any.invalid');
  }
};

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  APP_NAME: string;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  CORS_ORIGINS: string;
  SWAGGER_ENABLED: boolean;
  HTTP_BODY_LIMIT_BYTES: number;
  HTTP_REQUEST_TIMEOUT_MS: number;
  HTTP_HEADERS_TIMEOUT_MS: number;
  HTTP_KEEP_ALIVE_TIMEOUT_MS: number;
  HTTP_TRUST_PROXY_HOPS: number;
  HTTP_MAX_REQUESTS_PER_SOCKET: number;
  RATE_LIMIT_TTL_MS: number;
  RATE_LIMIT_MAX: number;
  DATABASE_URL: string;
  DATABASE_POOL_MAX: number;
  DATABASE_CONNECTION_TIMEOUT_MS: number;
  DATABASE_STATEMENT_TIMEOUT_MS: number;
  DATABASE_SLOW_QUERY_MS: number;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: number;
  PASSWORD_RESET_TOKEN_TTL_MINUTES: number;
  AUTH_REFRESH_COOKIE_NAME: string;
  AUTH_COOKIE_SECURE: boolean;
  FRONTEND_URL: string;
  EMAIL_PROVIDER: 'log' | 'capture' | 'resend';
  EMAIL_FROM_NAME: string;
  EMAIL_FROM_ADDRESS: string;
  EMAIL_REPLY_TO: string;
  EMAIL_SUPPORT_ADDRESS: string;
  EMAIL_SMOKE_TEST_RECIPIENT?: string;
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  BILLING_PROVIDER: 'stub' | 'stripe';
  BILLING_TRIAL_DAYS: number;
  BILLING_GRACE_PERIOD_DAYS: number;
  BILLING_CURRENCY: 'usd';
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRO_PRODUCT_ID: string;
  STRIPE_PRO_MONTHLY_PRICE_ID: string;
  STRIPE_PRO_ANNUAL_PRICE_ID: string;
  STRIPE_AUTOMATIC_TAX_ENABLED: boolean;
  FILE_STORAGE_PROVIDER: 'local' | 's3';
  FILE_LOCAL_ROOT: string;
  FILE_MALWARE_SCAN_ENABLED: boolean;
  AWS_REGION?: string;
  S3_BUCKET?: string;
  S3_ENDPOINT?: string;
  S3_FORCE_PATH_STYLE: boolean;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_CALLBACK_URL: string;
}

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  APP_NAME: Joi.string().trim().min(1).default('ShipFlow API'),

  LOG_LEVEL: Joi.string()
    .valid('debug', 'info', 'warn', 'error')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().default('info'),
      otherwise: Joi.string().default('debug'),
    }),

  CORS_ORIGINS: Joi.string()
    .trim()
    .custom(normalizeCorsOrigins, 'CORS origin validation')
    .default('http://localhost:5173'),

  SWAGGER_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().default(false),
    otherwise: Joi.boolean().default(true),
  }),

  HTTP_BODY_LIMIT_BYTES: Joi.number()
    .integer()
    .min(1024)
    .max(5 * 1024 * 1024)
    .default(1024 * 1024),
  HTTP_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120000)
    .default(30000),
  HTTP_HEADERS_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(15000),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(5000),
  HTTP_TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  HTTP_MAX_REQUESTS_PER_SOCKET: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(1000),
  RATE_LIMIT_TTL_MS: Joi.number()
    .integer()
    .min(1000)
    .max(60 * 60 * 1000)
    .default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).max(10000).default(120),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),

  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(60000)
    .default(5000),

  DATABASE_STATEMENT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120000)
    .default(15000),

  DATABASE_SLOW_QUERY_MS: Joi.number()
    .integer()
    .min(10)
    .max(60000)
    .default(500),

  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default(
        'local-only-jwt-secret-change-me-before-production',
      ),
    }),

  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),

  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),

  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(168)
    .default(24),

  PASSWORD_RESET_TOKEN_TTL_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(60),

  AUTH_REFRESH_COOKIE_NAME: Joi.string()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .default('shipflow_refresh'),

  AUTH_COOKIE_SECURE: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),

  FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .uri({ scheme: ['https'] })
        .required(),
      otherwise: Joi.string().default('http://localhost:5173'),
    }),

  EMAIL_PROVIDER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('resend').required(),
    otherwise: Joi.when('NODE_ENV', {
      is: 'test',
      then: Joi.string().valid('log', 'capture', 'resend').default('capture'),
      otherwise: Joi.string().valid('log', 'capture', 'resend').default('log'),
    }),
  }),

  EMAIL_FROM_NAME: Joi.string().trim().min(1).max(100).default('ShipFlow'),
  EMAIL_FROM_ADDRESS: Joi.string()
    .trim()
    .lowercase()
    .email()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('no-reply@mail.example.com'),
    }),
  EMAIL_REPLY_TO: Joi.string()
    .trim()
    .lowercase()
    .email()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('support@example.com'),
    }),
  EMAIL_SUPPORT_ADDRESS: Joi.string()
    .trim()
    .lowercase()
    .email()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default('support@example.com'),
    }),
  EMAIL_SMOKE_TEST_RECIPIENT: Joi.string()
    .trim()
    .lowercase()
    .email()
    .empty('')
    .optional(),
  RESEND_API_KEY: Joi.string().trim().empty('').when('EMAIL_PROVIDER', {
    is: 'resend',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  RESEND_WEBHOOK_SECRET: Joi.string().trim().empty('').when('EMAIL_PROVIDER', {
    is: 'resend',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  BILLING_PROVIDER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('stripe').required(),
    otherwise: Joi.string().valid('stub', 'stripe').default('stub'),
  }),
  BILLING_TRIAL_DAYS: Joi.number().integer().min(1).max(30).default(14),
  BILLING_GRACE_PERIOD_DAYS: Joi.number().integer().min(1).max(30).default(7),
  BILLING_CURRENCY: Joi.string().valid('usd').default('usd'),
  STRIPE_SECRET_KEY: Joi.string().trim().empty('').when('BILLING_PROVIDER', {
    is: 'stripe',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.string()
    .trim()
    .empty('')
    .when('BILLING_PROVIDER', {
      is: 'stripe',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  STRIPE_PRO_PRODUCT_ID: Joi.string()
    .trim()
    .when('BILLING_PROVIDER', {
      is: 'stripe',
      then: Joi.string()
        .pattern(/^prod_/)
        .required(),
      otherwise: Joi.string().default('prod_local_pro'),
    }),
  STRIPE_PRO_MONTHLY_PRICE_ID: Joi.string()
    .trim()
    .when('BILLING_PROVIDER', {
      is: 'stripe',
      then: Joi.string()
        .pattern(/^price_/)
        .required(),
      otherwise: Joi.string().default('price_local_pro_monthly'),
    }),
  STRIPE_PRO_ANNUAL_PRICE_ID: Joi.string()
    .trim()
    .when('BILLING_PROVIDER', {
      is: 'stripe',
      then: Joi.string()
        .pattern(/^price_/)
        .required(),
      otherwise: Joi.string().default('price_local_pro_annual'),
    }),
  STRIPE_AUTOMATIC_TAX_ENABLED: Joi.boolean().when('NODE_ENV', {
    is: 'production',
    then: Joi.boolean().valid(true).default(true),
    otherwise: Joi.boolean().default(false),
  }),

  FILE_STORAGE_PROVIDER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('s3').required(),
    otherwise: Joi.string().valid('local', 's3').default('local'),
  }),
  FILE_LOCAL_ROOT: Joi.string().trim().min(1).default('.data/files'),
  FILE_MALWARE_SCAN_ENABLED: Joi.boolean().when('FILE_STORAGE_PROVIDER', {
    is: 's3',
    then: Joi.when('NODE_ENV', {
      is: 'production',
      then: Joi.boolean().valid(true).default(true),
      otherwise: Joi.boolean().default(false),
    }),
    otherwise: Joi.boolean().valid(false).default(false),
  }),
  AWS_REGION: Joi.string().trim().empty('').when('FILE_STORAGE_PROVIDER', {
    is: 's3',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_BUCKET: Joi.string()
    .trim()
    .empty('')
    .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .when('FILE_STORAGE_PROVIDER', {
      is: 's3',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  S3_ENDPOINT: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .empty('')
    .optional(),
  S3_FORCE_PATH_STYLE: Joi.boolean().default(false),

  GOOGLE_CLIENT_ID: Joi.string().trim().empty('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().trim().empty('').when('GOOGLE_CLIENT_ID', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  GOOGLE_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/api/v1/auth/oauth/google/callback'),

  GITHUB_CLIENT_ID: Joi.string().trim().empty('').optional(),
  GITHUB_CLIENT_SECRET: Joi.string().trim().empty('').when('GITHUB_CLIENT_ID', {
    is: Joi.exist(),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  GITHUB_CALLBACK_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/api/v1/auth/oauth/github/callback'),
})
  .with('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  .with('GOOGLE_CLIENT_SECRET', 'GOOGLE_CLIENT_ID')
  .with('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET')
  .with('GITHUB_CLIENT_SECRET', 'GITHUB_CLIENT_ID');
