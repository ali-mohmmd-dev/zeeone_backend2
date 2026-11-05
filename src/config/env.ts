import dotenv from 'dotenv';
import { normalizeNodeEnv, parseLogLevel } from './logging.js';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: normalizeNodeEnv(process.env.NODE_ENV),
  logLevel: parseLogLevel(process.env.LOG_LEVEL),
  databaseUrl: process.env.POSTGRES_PRISMA_DATABASE_URL
    || process.env.DATABASE_URL
    || '',
  jwtSecret: process.env.JWT_SECRET || 'crm_elevate_super_secure_jwt_secret_key_2026',
  cookieSecret: process.env.COOKIE_SECRET || 'crm_elevate_cookie_secret_key_2026_very_long',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  backendUrl: process.env.BACKEND_URL || 'https://crm-backend-ten-pi.vercel.app',
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || '',
  meta: {
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    appSecret: process.env.META_APP_SECRET || '',
    pageId: process.env.META_PAGE_ID || '',
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
    graphVersion: process.env.META_GRAPH_API_VERSION || '',
    branchId: process.env.META_DEFAULT_BRANCH_ID || '',
    integrationUserId: process.env.META_INTEGRATION_USER_ID || '',
    assigneeId: process.env.META_DEFAULT_ASSIGNEE_ID || '',
    formIds: (process.env.META_FORM_IDS || '').split(',').map(value => value.trim()).filter(Boolean),
    processSecret: process.env.CRON_SECRET || '',
  },
};
