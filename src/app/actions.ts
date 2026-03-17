
"use server";

import {
  suggestEquitableSplits,
  SuggestEquitableSplitsInput,
  SuggestEquitableSplitsOutput,
} from "@/ai/flows/suggest-equitable-splits";
import { 
  generateReport,
  GenerateReportOutput 
} from "@/ai/flows/generate-report";
import { z } from "zod";
import {
  verifyAdminPassword,
  getAppConfig,
  updateUserPhoneNumber,
  addExpense,
  addContribution,
  addAdminAuditLog,
  rolloverMonthWithArchive,
} from "@/lib/firestore";

const actionSchema = z.object({
  amount: z.number(),
  payer: z.string(),
  participants: z.array(z.string()),
  tags: z.array(z.string()).optional(),
  note: z.string().optional(),
});

export async function suggestEquitableSplitsAction(
  input: SuggestEquitableSplitsInput
): Promise<SuggestEquitableSplitsOutput | null> {
  try {
    const validatedInput = actionSchema.parse(input);
    const result = await suggestEquitableSplits(validatedInput);
    return result;
  } catch (error) {
    console.error("Error in suggestEquitableSplitsAction:", error);
    if (error instanceof z.ZodError) {
      console.error("Validation errors:", error.errors);
    }
    return null;
  }
}

export async function generateReportAction(
  token: string | null,
): Promise<GenerateReportOutput | null> {
  if (!verifyAdmin(token)) {
    console.warn("Blocked unauthorized report generation attempt.");
    return null;
  }

  try {
    const appConfig = await getAppConfig();
    if (appConfig?.modelApiKey) {
      process.env.GOOGLE_API_KEY = appConfig.modelApiKey;
    }
    const result = await generateReport();
    await logAdminAction("report.generate", {
      hasModelApiKey: !!appConfig?.modelApiKey,
    });
    return result;
  } catch (error) {
    console.error("Error in generateReportAction:", error);
    return null;
  }
}

type StartNewMonthOutput = {
  success: boolean;
  error?: string;
  message?: string;
};

type AdminWriteOutput = {
  success: boolean;
  error?: string;
};

type CreateExpenseInput = {
  description: string;
  amount: number;
  payerId: string;
  tags: string[];
  participants: { userId: string; share: number }[];
  dateIso: string;
};

type CreateContributionInput = {
  contributorId: string;
  amount: number;
  dateIso: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}


function verifyAdmin(token: string | null): boolean {
  // The admin user is not a real firebase user, but we've stored their ID as 'admin' in localStorage.
  // The token here is just the raw value from local storage. In a real app with Firebase Admin SDK,
  // we would verify this token. For this context, we trust the client-side value.
  return token === 'admin';
}

async function logAdminAction(
  action: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await addAdminAuditLog({ action, metadata });
  } catch (error) {
    console.warn(`Admin audit log failed for action: ${action}`, error);
  }
}

export async function createExpenseAction(
  token: string | null,
  input: CreateExpenseInput,
): Promise<AdminWriteOutput> {
  if (!verifyAdmin(token)) {
    return { success: false, error: "Authorization failed: Not an admin." };
  }

  if (!input.description.trim() || input.amount <= 0 || !input.payerId) {
    return { success: false, error: "Invalid expense payload." };
  }

  const expenseDate = new Date(input.dateIso);
  if (Number.isNaN(expenseDate.getTime())) {
    return { success: false, error: "Invalid expense date." };
  }

  try {
    await addExpense({
      description: input.description.trim(),
      amount: input.amount,
      payerId: input.payerId,
      tags: input.tags,
      participants: input.participants,
      date: expenseDate,
    });
    await logAdminAction("expense.create", {
      payerId: input.payerId,
      amount: input.amount,
      participantCount: input.participants.length,
      tagCount: input.tags.length,
      dateIso: input.dateIso,
    });
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in createExpenseAction:", error);
    return {
      success: false,
      error: getErrorMessage(error) || "Failed to create expense.",
    };
  }
}

export async function createContributionAction(
  token: string | null,
  input: CreateContributionInput,
): Promise<AdminWriteOutput> {
  if (!verifyAdmin(token)) {
    return { success: false, error: "Authorization failed: Not an admin." };
  }

  if (!input.contributorId || input.amount <= 0) {
    return { success: false, error: "Invalid contribution payload." };
  }

  const contributionDate = new Date(input.dateIso);
  if (Number.isNaN(contributionDate.getTime())) {
    return { success: false, error: "Invalid contribution date." };
  }

  try {
    await addContribution({
      contributorId: input.contributorId,
      amount: input.amount,
      date: contributionDate,
    });
    await logAdminAction("contribution.create", {
      contributorId: input.contributorId,
      amount: input.amount,
      dateIso: input.dateIso,
    });
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in createContributionAction:", error);
    return {
      success: false,
      error: getErrorMessage(error) || "Failed to create contribution.",
    };
  }
}

export async function updateUserPhoneNumberAction(
  userId: string,
  phoneNumber: string,
  token: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!verifyAdmin(token)) {
    return { success: false, error: "Authorization failed: Not an admin." };
  }
  
  if (!userId || !phoneNumber || !/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    return { success: false, error: "Invalid user ID or phone number format." };
  }

  try {
    await updateUserPhoneNumber(userId, phoneNumber);
    await logAdminAction("member.phone.update", {
      userId,
      phoneNumber,
    });
    return { success: true };
  } catch (error: unknown) {
    console.error("Error in updateUserPhoneNumberAction:", error);
    return {
      success: false,
      error: getErrorMessage(error) || "Failed to update phone number.",
    };
  }
}

export async function startNewMonthAction(
  token: string | null,
  adminPassword: string,
): Promise<StartNewMonthOutput> {
  // 1. Authenticate user as admin
  if (!verifyAdmin(token)) {
    return { success: false, error: "Authorization failed: Not an admin." };
  }

  if (!adminPassword.trim()) {
    return { success: false, error: "Admin password is required." };
  }

  try {
    const isValidAdminPassword = await verifyAdminPassword(adminPassword);
    if (!isValidAdminPassword) {
      return { success: false, error: "Invalid admin password." };
    }

    const rollover = await rolloverMonthWithArchive();

    await logAdminAction("month.rollover.start", {
      archiveId: rollover.id,
      periodLabel: rollover.periodLabel,
      expenseCount: rollover.expenseCount,
      contributionCount: rollover.contributionCount,
      messageCount: rollover.messageCount,
    });

    return {
      success: true,
      message: `New month started. Archived ${rollover.periodLabel} data for history.`,
    };

  } catch (error: unknown) {
    console.error("Error in startNewMonthAction:", error);
    // This consolidated catch block ensures a response is always returned.
    return {
      success: false,
      error:
        getErrorMessage(error) ||
        "An unknown error occurred during the 'Start New Month' process.",
    };
  }
}
