
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
  getAllUsers,
  getAllExpensesForReport,
  getAllContributionsForReport,
  getAllChatMessages,
  clearAllData,
  getUser,
  updateUserPhoneNumber,
} from "@/lib/firestore";
import type { Expense, Contribution, ChatMessage } from "@/lib/types";
import { archiveDataToSheet } from "@/lib/sheets";

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

export async function generateReportAction(): Promise<GenerateReportOutput | null> {
  try {
    const result = await generateReport();
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


function verifyAdmin(token: string | null): boolean {
  // The admin user is not a real firebase user, but we've stored their ID as 'admin' in localStorage.
  // The token here is just the raw value from local storage. In a real app with Firebase Admin SDK,
  // we would verify this token. For this context, we trust the client-side value.
  return token === 'admin';
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
    return { success: true };
  } catch (error: any) {
    console.error("Error in updateUserPhoneNumberAction:", error);
    return { success: false, error: error.message || "Failed to update phone number." };
  }
}

export async function startNewMonthAction(token: string | null): Promise<StartNewMonthOutput> {
  // 1. Authenticate user as admin
  if (!verifyAdmin(token)) {
    return { success: false, error: "Authorization failed: Not an admin." };
  }

  try {
    // 2. Archive data to Google Sheets
    await archiveDataToSheet();
    
    // 3. Clear all data from Firestore
    await clearAllData();

    return {
      success: true,
      message: "Data has been successfully archived to Google Sheets and the new month has started.",
    };

  } catch (error: any) {
    console.error("Error in startNewMonthAction:", error);
    // This consolidated catch block ensures a response is always returned.
    return { success: false, error: error.message || "An unknown error occurred during the 'Start New Month' process." };
  }
}
