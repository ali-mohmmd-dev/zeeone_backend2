import { config } from '../../config/env.js';
import { BadRequestError } from '../../errors/app-error.js';

export class EmailService {
  static async sendInvoice(to: string, invoiceNumber: string, pdf: Uint8Array, reminder = false) {
    if (!config.resendApiKey || !config.emailFrom) {
      throw new BadRequestError('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM on the backend.');
    }
    const subject = reminder ? `Payment reminder: Invoice ${invoiceNumber}` : `Invoice ${invoiceNumber}`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: config.emailFrom,
        to: [to],
        subject,
        html: `<p>Please find invoice <strong>${escapeHtml(invoiceNumber)}</strong> attached.</p><p>Thank you.</p>`,
        attachments: [{ filename: `${invoiceNumber}.pdf`, content: Buffer.from(pdf).toString('base64') }],
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestError(`Email provider rejected the message (${response.status}): ${detail.slice(0, 300)}`);
    }
    return response.json() as Promise<{ id: string }>;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
