import { FastifyReply, FastifyRequest } from 'fastify';
import { successResponse } from '../../utils/response.js';
import { createCustomerSchema } from './customer.schema.js';
import { CustomerService } from './customer.service.js';

export class CustomerController {
  static async listInvoiceCustomers(request: FastifyRequest, reply: FastifyReply) {
    const service = new CustomerService(request.server.prisma);
    const customers = await service.listInvoiceCustomers();
    return reply.send(successResponse(customers));
  }

  static async createCustomer(request: FastifyRequest, reply: FastifyReply) {
    const validated = createCustomerSchema.parse(request.body);
    const service = new CustomerService(request.server.prisma);
    const customer = await service.createCustomer(validated, request.user.id);
    return reply.status(201).send(successResponse(customer, 'Customer created successfully'));
  }

  static async createFromAdmission(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const service = new CustomerService(request.server.prisma);
    const customer = await service.createCustomerFromAdmission(id, request.user.id);
    return reply.status(201).send(successResponse(customer, 'Admission added to customers'));
  }
}
