import fastify, { FastifyInstance, LogController } from 'fastify';
import sensible from '@fastify/sensible';
import { config } from './config/env.js';
import { configureRequestLogging, getLoggerOptions } from './config/logging.js';
import helmet from '@fastify/helmet';
import prismaPlugin from './plugins/prisma.js';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import swaggerPlugin from './plugins/swagger.js';
import { errorHandler } from './middleware/error.middleware.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { masterDataRoutes } from './modules/master-data/master-data.routes.js';
import { enquiryRoutes } from './modules/enquiries/enquiry.routes.js';
import { followUpRoutes } from './modules/follow-ups/follow-up.routes.js';
import { callLogRoutes } from './modules/call-logs/call-log.routes.js';
import { admissionRoutes } from './modules/admissions/admission.routes.js';
import { invoiceRoutes } from './modules/invoices/invoice.routes.js';
import { publicInvoiceRoutes } from './modules/invoices/public-invoice.routes.js';
import { customerRoutes } from './modules/customers/customer.routes.js';
import { receiptRoutes } from './modules/receipts/receipt.routes.js';
import { expenseRoutes } from './modules/expenses/expense.routes.js';
import { serviceRoutes } from './modules/services/service.routes.js';
import { jobOrderRoutes } from './modules/job-orders/job-order.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { reportRoutes } from './modules/reports/report.routes.js';
import { workflowRoutes } from './modules/workflows/workflow.routes.js';
import { metaLeadRoutes } from './modules/meta-leads/meta-lead.routes.js';
import { uiRoutes } from './modules/workflows/ui.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: getLoggerOptions({ nodeEnv: config.nodeEnv, vercel: process.env.VERCEL, logLevel: config.logLevel }),
    logController: new LogController({ disableRequestLogging: true }),
  });
  configureRequestLogging(app);

  // Core Plugins
  await app.register(sensible);
  await app.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  });
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(prismaPlugin);
  await app.register(swaggerPlugin);

  // Error Handler
  app.setErrorHandler(errorHandler);

  // Health Routes
  await app.register(healthRoutes);

  // API v1 Routes
  await app.register(
    async (v1) => {
      await v1.register(metaLeadRoutes, { prefix: '/integrations/meta' });
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(userRoutes, { prefix: '/users' });
      await v1.register(masterDataRoutes);
      await v1.register(enquiryRoutes, { prefix: '/enquiries' });
      await v1.register(followUpRoutes, { prefix: '/follow-ups' });
      await v1.register(callLogRoutes, { prefix: '/call-logs' });
      await v1.register(admissionRoutes, { prefix: '/admissions' });
      await v1.register(invoiceRoutes, { prefix: '/invoices' });
      await v1.register(publicInvoiceRoutes, { prefix: '/public/invoices' });
      await v1.register(customerRoutes, { prefix: '/customers' });
      await v1.register(receiptRoutes, { prefix: '/receipts' });
      await v1.register(expenseRoutes, { prefix: '/expenses' });
      await v1.register(serviceRoutes, { prefix: '/services' });
      await v1.register(jobOrderRoutes, { prefix: '/job-orders' });
      await v1.register(notificationRoutes, { prefix: '/notifications' });
      await v1.register(dashboardRoutes, { prefix: '/dashboard' });
      await v1.register(reportRoutes, { prefix: '/reports' });
      await v1.register(workflowRoutes, { prefix: '/workflows' });
      await v1.register(uiRoutes, { prefix: '/ui' });
    },
    { prefix: '/api/v1' }
  );

  return app;
}
