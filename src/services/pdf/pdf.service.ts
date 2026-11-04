import type { Template } from '@pdfme/common';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { InvoiceTemplateMapper, InvoiceWithItems } from './invoice-template-mapper.js';
import { ReceiptTemplateMapper, ReceiptWithAdmission } from './receipt-template-mapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PDFService {
  private static async getPdfme() {
    const [{ generate }, { text, table, svg, image, line, multiVariableText }] = await Promise.all([
      import('@pdfme/generator'),
      import('@pdfme/schemas'),
    ]);
    return {
      generate,
      plugins: { text, table, svg, image, line, multiVariableText },
    };
  }

  static async generateInvoicePDF(invoice: InvoiceWithItems): Promise<Uint8Array> {
    try {
      InvoiceTemplateMapper.validateInvoiceData(invoice);
      const template = await this.loadTemplate('invoice_template.json');
      const templateInputs = InvoiceTemplateMapper.mapToTemplateInputs(invoice);
      const { generate, plugins } = await this.getPdfme();

      return await generate({
        template,
        inputs: [templateInputs as any],
        plugins,
      });
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF');
    }
  }

  static async generateReceiptPDF(data: ReceiptWithAdmission): Promise<Uint8Array> {
    try {
      ReceiptTemplateMapper.validateReceiptData(data);
      const template = await this.loadTemplate('receipt_template.json');
      const templateInputs = ReceiptTemplateMapper.mapToTemplateInputs(data);
      const { generate, plugins } = await this.getPdfme();

      return await generate({
        template,
        inputs: [templateInputs as any],
        plugins,
      });
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw new Error('Failed to generate receipt PDF');
    }
  }

  private static async loadTemplate(templateFileName: string): Promise<Template> {
    const possiblePaths = [
      path.join(__dirname, 'templates', templateFileName),
      path.join(process.cwd(), 'dist', 'src', 'services', 'pdf', 'templates', templateFileName),
      path.join(process.cwd(), 'src', 'services', 'pdf', 'templates', templateFileName),
    ];

    for (const templatePath of possiblePaths) {
      if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        return JSON.parse(templateContent) as Template;
      }
    }

    throw new Error(`Template file not found: ${templateFileName}`);
  }
}
