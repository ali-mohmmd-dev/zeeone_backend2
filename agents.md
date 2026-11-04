# AGENTS.md (Fastify CRM API)

## Goal

Build a clean, simple, readable, scalable REST API for a CRM.
Prefer boring and obvious code over clever code.
Make the smallest change that solves the task. Do not add features, endpoints, or dependencies that were not requested.

## Stack

- Node.js (LTS), TypeScript (strict mode), Fastify 5
- Database: PostgreSQL (or the current DB) with Prisma. Do not swap the ORM.
- Validation and schemas: use what the project already uses (TypeBox or Zod). Do not mix both.
- Tests: Vitest, using `app.inject()` for HTTP tests
- Lint and format: ESLint + Prettier. Follow the existing config.

## Architecture

Domain modules + a small core. Dependencies flow one way:

`modules -> core / shared / infrastructure`. Never the other way around.

```
prisma/
├── schema.prisma
└── migrations/

src/
├── server.ts                      # starts the server only (listen, graceful shutdown)
├── app.ts                         # buildApp(): registers core plugins, then modules. No listen().
│
├── config/
│   ├── env.ts                     # validates and exports env vars (the ONLY place that reads process.env)
│   └── constants.ts               # app-wide constants (pagination defaults, roles)
│
├── core/                          # framework-level code, knows nothing about CRM business
│   ├── plugins/                   # fastify-plugin wrappers
│   │   ├── prisma.ts              # app.prisma
│   │   ├── auth.ts                # JWT verify, app.authenticate
│   │   ├── rbac.ts                # app.authorize(["ADMIN", "STAFF"])
│   │   ├── cors.ts
│   │   ├── swagger.ts
│   │   ├── request-id.ts
│   │   └── error-handler.ts       # setErrorHandler: AppError -> JSON envelope
│   ├── errors/                    # AppError, NotFoundError, ConflictError, ForbiddenError...
│   ├── http/
│   │   ├── response.ts            # success/paginated response envelope helpers
│   │   ├── pagination.ts          # parse page/limit, build meta
│   │   └── common.schemas.ts      # IdParams, PaginationQuery, shared schemas
│   ├── events/                    # (optional) typed in-process event bus
│   │   ├── event-bus.ts
│   │   └── event-types.ts
│   └── types/
│       └── fastify.d.ts           # FastifyInstance / FastifyRequest augmentation
│
├── modules/                       # ONE FOLDER PER BUSINESS FEATURE
│   ├── index.ts                   # registers every module with its URL prefix
│   │
│   ├── auth/
│   ├── users/
│   ├── master-data/
│   │
│   ├── enquiries/
│   │   ├── enquiries.routes.ts        # path + schema + handler wiring only
│   │   ├── enquiries.controller.ts    # reads request, calls service, shapes reply
│   │   ├── enquiries.service.ts       # business rules
│   │   ├── enquiries.repository.ts    # all Prisma queries for this module
│   │   ├── enquiries.schemas.ts       # request/response validation schemas
│   │   ├── enquiries.types.ts         # DTO and domain types
│   │   ├── enquiries.events.ts        # (optional) events this module emits/listens to
│   │   └── enquiries.test.ts
│   ├── follow-ups/
│   ├── call-logs/
│   ├── admissions/
│   │
│   ├── invoices/
│   │   ├── ...same files
│   │   └── invoices.pdf.ts            # maps invoice data -> PDF template input
│   ├── receipts/
│   ├── expenses/
│   │
│   ├── service-catalog/               # (was "services": renamed to avoid clashing with *.service.ts)
│   ├── job-orders/
│   │
│   ├── notifications/
│   ├── dashboard/
│   └── reports/
│
├── infrastructure/                # technical integrations, no business rules
│   ├── pdf/
│   │   ├── pdf.service.ts         # renders HTML/templates -> PDF buffer
│   │   └── templates/             # generic layouts (invoice, receipt, report)
│   ├── storage/                   # (when needed) file uploads
│   └── messaging/                 # (when needed) email / SMS / WhatsApp providers
│
├── jobs/                          # (when needed) scheduled/background work, e.g. follow-up reminders
│
└── shared/
    └── utils/                     # pure helpers: date, currency, number generators
```

### Module groups (for thinking, not folders)

| Domain         | Modules                                      |
| -------------- | -------------------------------------------- |
| Identity       | auth, users                                  |
| Sales pipeline | enquiries, follow-ups, call-logs, admissions |
| Finance        | invoices, receipts, expenses                 |
| Operations     | service-catalog, job-orders                  |
| Platform       | master-data, notifications                   |
| Insights       | dashboard, reports                           |

Keep `modules/` flat. If it grows past about 25 modules, group into domain folders.

## Layer rules (strict)

- **Routes**: declare method, path, schema, auth/RBAC `preHandler`, and the controller handler. Nothing else.
- **Controller**: read params/body/query, call ONE service method, return the response envelope. No business logic, no Prisma.
- **Service**: business rules. Never imports from `fastify`. Throws `AppError` subclasses.
- **Repository**: the only place that uses Prisma for that module's tables. Returns plain objects.
- Dependencies flow: routes -> controller -> service -> repository.
- A module never imports another module's repository. Call that module's service, or use an event.
- `core/` and `infrastructure/` never import from `modules/`.
- Every route declares a `schema` for params, query, body, and responses.
- Never return raw Prisma records. Map to the response schema (no password hashes, no internal fields).
- Never read `process.env` outside `config/env.ts`.
- Wire dependencies in each module's plugin function with plain constructor injection. No DI frameworks.

## Cross-module work

- **Direct call**: when module A needs data or an action from module B, A's service calls B's service.
- **Events** (optional, use only for side effects): when something happens that other modules react to, emit an event instead of calling them. Example: `admission.created` -> invoices creates the first invoice, notifications sends a message. Keep events typed in `core/events/event-types.ts`. Do not use events for anything that needs an immediate return value.
- **Transactions**: a multi-step write that must succeed or fail together (admission + invoice, payment + receipt) runs inside `prisma.$transaction`. Repository methods accept an optional transaction client parameter.

## Auth and RBAC

- Authentication and role checks are Fastify **plugins and `preHandler` hooks** in `core/plugins`, not Express-style middleware.
- Use `app.authenticate` and `app.authorize([...roles])` in route definitions.
- Never check roles inside controllers or services with scattered `if (role === ...)`. Use `authorize`, or a single helper for finer rules (for example "staff can edit only their own enquiries").

## Data and finance rules

- Money uses Prisma `Decimal`. Never `number` or float for amounts.
- Invoices, receipts, and expenses are never hard-deleted. Use status changes (for example `CANCELLED`) or soft delete, so history stays auditable.
- Invoice and receipt numbers are generated inside the same transaction that creates the record, so numbers never duplicate.
- Every table has `createdAt` and `updatedAt`. Record `createdById` where users act on data.
- List endpoints are always paginated, with a maximum `limit`.

## PDF rules

- `infrastructure/pdf` renders generic templates and knows nothing about invoices or admissions.
- Each module owns its mapping (for example `invoices.pdf.ts`) from its data to the template input.
- PDF generation is triggered from the service, and the controller streams or returns the buffer.

## Response and error format

- Success: `{ "data": ..., "meta": { ... } }` (meta only for paginated lists).
- Error: `{ "error": { "code": "...", "message": "..." } }`. The frontend relies on this exact shape.
- Services throw `AppError` subclasses. Only the global error handler turns them into HTTP responses.
- Never leak stack traces or internal messages in production.

## API conventions

- Prefix routes with `/api/v1`. Plural nouns: `/api/v1/enquiries`, `/api/v1/enquiries/:id`.
- Correct status codes: 201 create, 204 delete, 404 not found, 409 conflict, 400/422 validation, 401 unauthenticated, 403 forbidden.
- Include `GET /health`.

## Code style

- One statement per line. No clever one-liners, no nested ternaries, no deeply chained expressions.
- Functions do one thing and stay under about 30 lines.
- Early returns instead of nesting.
- Explicit types on function parameters and return values. No `any`. Use `unknown` and narrow.
- `async/await` only. No `.then()` chains.
- Descriptive names. Files are named `<module>.<layer>.ts`.
- No base classes, generics, or patterns unless asked.
- Comments explain why, not what.

## Testing

- Every new route gets at least one success test and one failure test.
- Test services with the repository mocked. Test routes with `app.inject()` against a test database.
- Tests must not depend on each other or on execution order.

## Adding a new module (checklist)

1. Create `src/modules/<name>/` with routes, controller, service, repository, schemas, types, and a test.
2. Register it in `src/modules/index.ts` with its prefix.
3. Add the Prisma model and create a migration. Never edit an applied migration.
4. Add auth and `authorize` roles on every route.
5. Follow the existing `enquiries` module as the reference for structure and style.

## Workflow

1. For anything larger than a small fix, show a short plan before writing code.
2. Before finishing, run: `npm run lint && npm run typecheck && npm test`
3. Summarize what changed and why. Mention any new dependency and justify it.

## Never do

- Never put business logic or Prisma calls in routes or controllers.
- Never import one module's repository from another module.
- Never use `float` or `number` for money.
- Never hard-delete financial records.
- Never use semicolon-chained or compressed code to save lines.
- Never commit secrets or `.env` files.
- Never disable lint rules or TypeScript checks to make errors go away.
- Never refactor unrelated code while working on a task.
