-- Preserve four fractional digits for unit prices and amounts; tax rates retain six.
BEGIN;

-- Hold the same table locks needed by ALTER while checking existing values.
LOCK TABLE "course", "service", "admission", "receipt", "invoice", "invoice_item", "payment", "expense", "service_bill", "service_bill_item", "proposal", "proposal_item" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "course" WHERE "courseFee"::text IN ('NaN', 'Infinity', '-Infinity') OR "admissionFee"::text IN ('NaN', 'Infinity', '-Infinity') OR "semesterFee"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in course';
    END IF;
    IF EXISTS (SELECT 1 FROM "service" WHERE "price"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in service';
    END IF;
    IF EXISTS (SELECT 1 FROM "admission" WHERE "balance"::text IN ('NaN', 'Infinity', '-Infinity') OR "agentCommission"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in admission';
    END IF;
    IF EXISTS (SELECT 1 FROM "receipt" WHERE "amountCollected"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in receipt';
    END IF;
    IF EXISTS (SELECT 1 FROM "invoice" WHERE "subtotal"::text IN ('NaN', 'Infinity', '-Infinity') OR "taxRate"::text IN ('NaN', 'Infinity', '-Infinity') OR "taxAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "discountAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "withholdingAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "serviceCharge"::text IN ('NaN', 'Infinity', '-Infinity') OR "otherCharges"::text IN ('NaN', 'Infinity', '-Infinity') OR "totalAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "amountPaid"::text IN ('NaN', 'Infinity', '-Infinity') OR "balanceDue"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in invoice';
    END IF;
    IF EXISTS (SELECT 1 FROM "invoice_item" WHERE "unitPrice"::text IN ('NaN', 'Infinity', '-Infinity') OR "lineTotal"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in invoice_item';
    END IF;
    IF EXISTS (SELECT 1 FROM "payment" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in payment';
    END IF;
    IF EXISTS (SELECT 1 FROM "expense" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in expense';
    END IF;
    IF EXISTS (SELECT 1 FROM "service_bill" WHERE "total"::text IN ('NaN', 'Infinity', '-Infinity') OR "paid"::text IN ('NaN', 'Infinity', '-Infinity') OR "balance"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in service_bill';
    END IF;
    IF EXISTS (SELECT 1 FROM "service_bill_item" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in service_bill_item';
    END IF;
    IF EXISTS (SELECT 1 FROM "proposal" WHERE "subtotal"::text IN ('NaN', 'Infinity', '-Infinity') OR "taxRate"::text IN ('NaN', 'Infinity', '-Infinity') OR "taxAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "discountAmount"::text IN ('NaN', 'Infinity', '-Infinity') OR "totalAmount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in proposal';
    END IF;
    IF EXISTS (SELECT 1 FROM "proposal_item" WHERE "unitPrice"::text IN ('NaN', 'Infinity', '-Infinity') OR "total"::text IN ('NaN', 'Infinity', '-Infinity')) THEN
        RAISE EXCEPTION 'Cannot migrate non-finite monetary values in proposal_item';
    END IF;
END $$;

ALTER TABLE "course"
    ALTER COLUMN "courseFee" TYPE DECIMAL(19,4) USING "courseFee"::DECIMAL(19,4),
    ALTER COLUMN "admissionFee" TYPE DECIMAL(19,4) USING "admissionFee"::DECIMAL(19,4),
    ALTER COLUMN "semesterFee" TYPE DECIMAL(19,4) USING "semesterFee"::DECIMAL(19,4);

ALTER TABLE "service"
    ALTER COLUMN "price" TYPE DECIMAL(19,4) USING "price"::DECIMAL(19,4);

ALTER TABLE "admission"
    ALTER COLUMN "balance" TYPE DECIMAL(19,4) USING "balance"::DECIMAL(19,4),
    ALTER COLUMN "agentCommission" TYPE DECIMAL(19,4) USING "agentCommission"::DECIMAL(19,4);

ALTER TABLE "receipt"
    ALTER COLUMN "amountCollected" TYPE DECIMAL(19,4) USING "amountCollected"::DECIMAL(19,4);

ALTER TABLE "invoice"
    ALTER COLUMN "subtotal" TYPE DECIMAL(19,4) USING "subtotal"::DECIMAL(19,4),
    ALTER COLUMN "taxRate" TYPE DECIMAL(9,6) USING "taxRate"::DECIMAL(9,6),
    ALTER COLUMN "taxAmount" TYPE DECIMAL(19,4) USING "taxAmount"::DECIMAL(19,4),
    ALTER COLUMN "discountAmount" TYPE DECIMAL(19,4) USING "discountAmount"::DECIMAL(19,4),
    ALTER COLUMN "withholdingAmount" TYPE DECIMAL(19,4) USING "withholdingAmount"::DECIMAL(19,4),
    ALTER COLUMN "serviceCharge" TYPE DECIMAL(19,4) USING "serviceCharge"::DECIMAL(19,4),
    ALTER COLUMN "otherCharges" TYPE DECIMAL(19,4) USING "otherCharges"::DECIMAL(19,4),
    ALTER COLUMN "totalAmount" TYPE DECIMAL(19,4) USING "totalAmount"::DECIMAL(19,4),
    ALTER COLUMN "amountPaid" TYPE DECIMAL(19,4) USING "amountPaid"::DECIMAL(19,4),
    ALTER COLUMN "balanceDue" TYPE DECIMAL(19,4) USING "balanceDue"::DECIMAL(19,4);

ALTER TABLE "invoice_item"
    ALTER COLUMN "unitPrice" TYPE DECIMAL(19,4) USING "unitPrice"::DECIMAL(19,4),
    ALTER COLUMN "lineTotal" TYPE DECIMAL(19,4) USING "lineTotal"::DECIMAL(19,4);

ALTER TABLE "payment"
    ALTER COLUMN "amount" TYPE DECIMAL(19,4) USING "amount"::DECIMAL(19,4);

ALTER TABLE "expense"
    ALTER COLUMN "amount" TYPE DECIMAL(19,4) USING "amount"::DECIMAL(19,4);

ALTER TABLE "service_bill"
    ALTER COLUMN "total" TYPE DECIMAL(19,4) USING "total"::DECIMAL(19,4),
    ALTER COLUMN "paid" TYPE DECIMAL(19,4) USING "paid"::DECIMAL(19,4),
    ALTER COLUMN "balance" TYPE DECIMAL(19,4) USING "balance"::DECIMAL(19,4);

ALTER TABLE "service_bill_item"
    ALTER COLUMN "amount" TYPE DECIMAL(19,4) USING "amount"::DECIMAL(19,4);

ALTER TABLE "proposal"
    ALTER COLUMN "subtotal" TYPE DECIMAL(19,4) USING "subtotal"::DECIMAL(19,4),
    ALTER COLUMN "taxRate" TYPE DECIMAL(9,6) USING "taxRate"::DECIMAL(9,6),
    ALTER COLUMN "taxAmount" TYPE DECIMAL(19,4) USING "taxAmount"::DECIMAL(19,4),
    ALTER COLUMN "discountAmount" TYPE DECIMAL(19,4) USING "discountAmount"::DECIMAL(19,4),
    ALTER COLUMN "totalAmount" TYPE DECIMAL(19,4) USING "totalAmount"::DECIMAL(19,4);

ALTER TABLE "proposal_item"
    ALTER COLUMN "unitPrice" TYPE DECIMAL(19,4) USING "unitPrice"::DECIMAL(19,4),
    ALTER COLUMN "total" TYPE DECIMAL(19,4) USING "total"::DECIMAL(19,4);

COMMIT;
