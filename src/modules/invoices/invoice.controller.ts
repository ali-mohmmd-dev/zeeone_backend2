import { decimal } from '../../shared/utils/money.js';
import { FastifyReply, FastifyRequest } from 'fastify';
import { paginatedResponse, successResponse } from '../../utils/response.js';
import { createInvoiceSchema, createPaymentSchema, invoiceFilterSchema, invoiceItemInputSchema, paymentSettingsSchema, reminderSettingsSchema, sendInvoiceSchema, updateInvoiceSchema } from './invoice.schema.js';
import { InvoiceService } from './invoice.service.js';
import { InvoiceWorkflowService } from './invoice-workflow.service.js';
import { EmailService } from '../../services/email/email.service.js';
import { config } from '../../config/env.js';
import { PDFService } from '../../services/pdf/pdf.service.js';

export class InvoiceController {
  static async listInvoices(request: FastifyRequest, reply: FastifyReply) {
    const filters = invoiceFilterSchema.parse(request.query);
    const service = new InvoiceService(request.server.prisma);
    const { invoices, total } = await service.listInvoices(filters);
    return reply.send(paginatedResponse(invoices, total, filters.page, filters.limit));
  }

  static async getInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new InvoiceService(request.server.prisma);
    const invoice = await service.getInvoiceById(id);
    return reply.send(successResponse(invoice));
  }

  static async createInvoice(request: FastifyRequest, reply: FastifyReply) {
    const validated = createInvoiceSchema.parse(request.body);
    const service = new InvoiceService(request.server.prisma);
    const created = await service.createInvoice(validated, request.user.id);
    return reply.status(201).send(successResponse(created, 'Invoice created successfully'));
  }

  static async updateInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const validated = updateInvoiceSchema.parse(request.body);
    const service = new InvoiceService(request.server.prisma);
    const updated = await service.updateInvoice(id, validated, request.user.id);
    return reply.send(successResponse(updated, 'Invoice updated successfully'));
  }

  static async deleteInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new InvoiceService(request.server.prisma);
    await service.deleteInvoice(id);
    return reply.send(successResponse(null, 'Invoice deleted successfully'));
  }

  static async generatePDF(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { download } = (request.query as { download?: string }) || {};
    const service = new InvoiceService(request.server.prisma);
    const pdfBuffer = await service.generatePDF(id);

    reply.header('Content-Type', 'application/pdf');
    if (download === 'true') {
      reply.header('Content-Disposition', `attachment; filename="Invoice-${id}.pdf"`);
    } else {
      reply.header('Content-Disposition', `inline; filename="Invoice-${id}.pdf"`);
    }

    return reply.send(Buffer.from(pdfBuffer));
  }

  static async createPayment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = createPaymentSchema.parse(request.body);
    const result = await new InvoiceWorkflowService(request.server.prisma).recordPayment(id, input, request.user.id);
    return reply.status(201).send(successResponse(result, 'Payment recorded successfully'));
  }

  static async addItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = invoiceItemInputSchema.parse(request.body);
    const invoice = await new InvoiceService(request.server.prisma).addItem(id, input, request.user.id);
    return reply.status(201).send(successResponse(invoice, 'Invoice item added'));
  }

  static async updateItem(request: FastifyRequest, reply: FastifyReply) {
    const { itemId } = request.params as { itemId: string };
    const input = invoiceItemInputSchema.partial().parse(request.body);
    const invoice = await new InvoiceService(request.server.prisma).updateItem(itemId, input, request.user.id);
    return reply.send(successResponse(invoice, 'Invoice item updated'));
  }

  static async deleteItem(request: FastifyRequest, reply: FastifyReply) {
    const { itemId } = request.params as { itemId: string };
    const invoice = await new InvoiceService(request.server.prisma).deleteItem(itemId, request.user.id);
    return reply.send(successResponse(invoice, 'Invoice item removed'));
  }

  static async deletePayment(request: FastifyRequest, reply: FastifyReply) {
    const { id, paymentId } = request.params as { id: string; paymentId: string };
    const invoice = await new InvoiceWorkflowService(request.server.prisma).deletePayment(id, paymentId, request.user.id);
    return reply.send(successResponse(invoice, 'Payment reversed successfully'));
  }

  static async getPaymentSettings(request: FastifyRequest, reply: FastifyReply) {
    const settings = await new InvoiceWorkflowService(request.server.prisma).getSettings();
    return reply.send(successResponse(settings));
  }

  static async updatePaymentSettings(request: FastifyRequest, reply: FastifyReply) {
    const input = paymentSettingsSchema.parse(request.body);
    const settings = await new InvoiceWorkflowService(request.server.prisma).updateSettings(input);
    return reply.send(successResponse(settings, 'Payment number settings saved'));
  }

  static async getNextPaymentNumber(request: FastifyRequest, reply: FastifyReply) {
    const preview = await new InvoiceWorkflowService(request.server.prisma).getNextNumber();
    return reply.send(successResponse(preview));
  }

  static async createShareLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await new InvoiceWorkflowService(request.server.prisma).createShareToken(id, request.user.id);
    const url = `${config.frontendUrl.replace(/\/$/, '')}/public/invoices/${result.shareToken}`;
    return reply.send(successResponse({ ...result, url }, 'Share link created'));
  }

  static async revokeShareLink(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const invoice = await new InvoiceWorkflowService(request.server.prisma).updateShareToken(id, request.user.id, null);
    return reply.send(successResponse(invoice, 'Share link revoked'));
  }

  static async updateReminders(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const input = reminderSettingsSchema.parse(request.body);
    const invoice = await new InvoiceWorkflowService(request.server.prisma).updateReminders(id, request.user.id, input.remindersEnabled, input.reminderRules);
    return reply.send(successResponse(invoice, 'Reminder settings saved'));
  }

  static async sendInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { email } = sendInvoiceSchema.parse(request.body ?? {});
    const service = new InvoiceService(request.server.prisma);
    const invoice = await service.getInvoiceById(id);
    const to = email || invoice.customer?.email;
    if (!to) return reply.badRequest('Add a customer email before sending this invoice');
    const pdf = await service.generatePDF(id);
    const providerResponse = await EmailService.sendInvoice(to, invoice.invoiceNumber, pdf);
    await request.server.prisma.$transaction(async (tx) => {
      if (invoice.status === 'DRAFT') await tx.invoice.update({ where: { id }, data: { status: 'SENT' } });
      await tx.invoiceActivity.create({ data: { invoiceId: id, userId: request.user.id, type: 'sent', message: `Invoice emailed to ${to}` } });
    });
    return reply.send(successResponse({ providerId: providerResponse.id }, 'Invoice emailed successfully'));
  }

  static async sendReminder(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { email } = sendInvoiceSchema.parse(request.body ?? {});
    const service = new InvoiceService(request.server.prisma);
    const invoice = await service.getInvoiceById(id);
    if (decimal(invoice.balanceDue).lessThanOrEqualTo(0) || invoice.status === 'DRAFT' || invoice.status === 'CANCELLED') {
      return reply.badRequest('A reminder can only be sent for an active invoice with a balance due');
    }
    const to = email || invoice.customer?.email;
    if (!to) return reply.badRequest('Add a customer email before sending a reminder');
    const pdf = await service.generatePDF(id);
    const providerResponse = await EmailService.sendInvoice(to, invoice.invoiceNumber, pdf, true);
    await request.server.prisma.invoiceActivity.create({ data: { invoiceId: id, userId: request.user.id, type: 'reminder_sent', message: `Payment reminder emailed to ${to}` } });
    return reply.send(successResponse({ providerId: providerResponse.id }, 'Reminder sent'));
  }

  static async getPublicInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };
    const invoice = await new InvoiceWorkflowService(request.server.prisma).publicInvoice(token);
    return reply.send(successResponse(invoice));
  }

  static async getPublicInvoicePDF(request: FastifyRequest, reply: FastifyReply) {
    const { token } = request.params as { token: string };
    const invoice = await new InvoiceWorkflowService(request.server.prisma).publicInvoice(token);
    const pdf = await PDFService.generateInvoicePDF(invoice as any);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    return reply.send(Buffer.from(pdf));
  }
}
