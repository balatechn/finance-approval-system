-- Pre-deploy: Remap removed enum values before schema push
-- Uses DO blocks to gracefully handle missing tables

DO $$ BEGIN
  UPDATE "ApprovalAction" SET "level" = 'DIRECTOR'
  WHERE "level" IN ('FINANCE_CONTROLLER', 'FINANCE_COORDINATOR');
EXCEPTION WHEN undefined_table OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE "FinanceRequest" SET "currentApprovalLevel" = 'DIRECTOR'
  WHERE "currentApprovalLevel" IN ('FINANCE_CONTROLLER', 'FINANCE_COORDINATOR');
EXCEPTION WHEN undefined_table OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE "FinanceRequest" SET "status" = 'PENDING_DIRECTOR'
  WHERE "status" IN ('PENDING_FINANCE_CONTROLLER', 'PENDING_FINANCE_COORDINATOR');
EXCEPTION WHEN undefined_table OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
  UPDATE "User" SET "role" = 'FINANCE_PLANNER'
  WHERE "role" IN ('FINANCE_CONTROLLER', 'FINANCE_COORDINATOR');
EXCEPTION WHEN undefined_table OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
  DELETE FROM "SLAConfig"
  WHERE "approvalLevel"::text IN ('FINANCE_CONTROLLER', 'FINANCE_COORDINATOR');
EXCEPTION WHEN undefined_table OR undefined_column OR invalid_text_representation THEN NULL;
END $$;

