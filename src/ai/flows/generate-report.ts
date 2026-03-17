
'use server';

/**
 * @fileOverview A Genkit flow for generating a financial report based on expenses and contributions.
 *
 * - generateReport - A function that analyzes financial data and returns a markdown report and chart data.
 * - GenerateReportOutput - The return type for the generateReport function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getAllUsers, getAllExpensesForReport, getAllContributionsForReport } from '@/lib/firestore';
import type { User, Expense, Contribution } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

const WALLET_PAYER_ID = 'shared-expense-tracker-wallet';

const ExpenseByCategorySchema = z.object({
  category: z.string().describe('The name of the expense category/tag.'),
  total: z.number().describe('The total amount spent in this category/tag.'),
});

const MemberContributionSchema = z.object({
  name: z.string().describe("The member's name."),
  total: z.number().describe("The member's total contribution (expenses paid + wallet contributions)."),
});


const AISummarySchema = z.object({
    summary: z.string().describe('A friendly and professional overall summary of the financial period. Do not include any specific numbers, just a general qualitative overview. Use Indian Rupees (₹) when referring to currency.')
});

const GenerateReportOutputSchema = z.object({
  report: z.string().describe('A detailed financial report in Markdown format, excluding the overall summary stats.'),
  expenseBreakdown: z.array(ExpenseByCategorySchema).describe('An array of objects, each representing an expense category/tag and its total spending.'),
  memberContributions: z.array(MemberContributionSchema).describe("An array of objects detailing each member's total contributions."),
  aiSummary: z.string().describe("The AI-generated qualitative summary."),
  totalContributions: z.number(),
  totalExpenses: z.number(),
  walletBalance: z.number(),
  expensePerMember: z.number(),
});

export type GenerateReportOutput = z.infer<typeof GenerateReportOutputSchema>;

export async function generateReport(): Promise<GenerateReportOutput> {
  const [users, expenses, contributions] = await Promise.all([
    getAllUsers(),
    getAllExpensesForReport(),
    getAllContributionsForReport(),
  ]);

  return generateReportFlow({ users, expenses, contributions });
}

const prompt = ai.definePrompt({
  name: 'generateFinancialReportSummaryPrompt',
  input: {
    schema: z.object({
        totalExpenses: z.number(),
        totalContributions: z.number(),
        walletBalance: z.number(),
        expenseCount: z.number(),
    }),
  },
  output: {
    schema: AISummarySchema,
  },
  prompt: `You are a financial analyst AI. Based on the summary numbers below, write a short, friendly, and professional overall summary for a financial report for a group of friends sharing a house.

Do not include any specific numbers or calculations in your summary. Just provide a one or two-paragraph qualitative overview. For example, you can mention if spending was high, if the wallet is healthy, etc. Keep it encouraging and light-hearted. Use Indian Rupees (₹) when referring to currency in general terms.

**Summary Data:**
- Total Expenses: {{totalExpenses}}
- Total Contributions: {{totalContributions}}
- Final Wallet Balance: {{walletBalance}}
- Number of Expenses: {{expenseCount}}
`,
});

const generateReportFlow = ai.defineFlow(
  {
    name: 'generateReportFlow',
    inputSchema: z.object({
      users: z.array(z.any()),
      expenses: z.array(z.any()),
      contributions: z.array(z.any()),
    }),
    outputSchema: GenerateReportOutputSchema,
  },
  async ({ users, expenses, contributions }) => {
    const typedUsers = users as User[];
    const typedExpenses = expenses as Expense[];
    const typedContributions = contributions as Contribution[];
    
    // --- 1. Perform all calculations in TypeScript ---

    const totalContributions = typedContributions.reduce((acc, c) => acc + c.amount, 0);
    const totalExpenses = typedExpenses.reduce((acc, e) => acc + e.amount, 0);
    const walletExpenses = typedExpenses
      .filter((expense) => expense.payerId === WALLET_PAYER_ID)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const walletBalance = totalContributions - walletExpenses;
    
    // Correct way to calculate expense breakdown by tag
    const breakdownMap = new Map<string, number>();
    typedExpenses.forEach(expense => {
        expense.tags.forEach((tag: string) => {
            breakdownMap.set(tag, (breakdownMap.get(tag) || 0) + expense.amount);
        });
    });
    const finalExpenseBreakdown = Array.from(breakdownMap, ([category, total]) => ({ category, total }));


    const memberBalances = new Map<string, { paid: number; share: number; contributed: number }>();
    typedUsers.forEach(u => memberBalances.set(u.id, { paid: 0, share: 0, contributed: 0 }));

    typedContributions.forEach(c => {
        const balance = memberBalances.get(c.contributorId);
        if (balance) {
            balance.contributed += c.amount;
        }
    });

    typedExpenses.forEach(e => {
      const participantCount = e.participants.length;
      const normalizedShare = participantCount > 0 ? e.amount / participantCount : 0;

        // Only credit the expense to a member if they paid for it personally, not from the wallet
        if (e.payerId !== WALLET_PAYER_ID) {
             const payerBalance = memberBalances.get(e.payerId);
             if (payerBalance) {
                payerBalance.paid += e.amount;
            }
        }
        // Distribute the share of the expense to all participants
        e.participants.forEach(p => {
            const participantBalance = memberBalances.get(p.userId);
            if (participantBalance) {
                participantBalance.share += normalizedShare;
            }
        });
    });

    const totalParticipantExpenseShare = Array.from(memberBalances.values())
      .reduce((sum, balance) => sum + balance.share, 0);
    const expensePerMember =
      typedUsers.length > 0 ? totalParticipantExpenseShare / typedUsers.length : 0;

    const memberContributions = typedUsers.map(user => {
      const balance = memberBalances.get(user.id) || { paid: 0, share: 0, contributed: 0 };
        return {
            name: user.name,
            total: balance.paid + balance.contributed,
        };
    }).filter(mc => mc.total > 0);


    // --- 2. Call AI for a simple summary ---
    const { output } = await prompt({
        totalExpenses,
        totalContributions,
        walletBalance,
        expenseCount: typedExpenses.length,
    });
    const aiSummary = output?.summary || "Here is your monthly financial summary.";


    // --- 3. Construct the report body in Markdown (excluding overall stats) ---

    let report = `
## Member Summary
| Member | Expenses Paid | Wallet Contributions | Share of Expenses | Net Balance |
| :--- | :---: | :---: | :---: | :---: |
`;
    
    const finalBalances = new Map<string, number>();

    typedUsers.forEach(user => {
      const balance = memberBalances.get(user.id) || { paid: 0, share: 0, contributed: 0 };
      const netBalance = (balance.paid + balance.contributed) - balance.share;
      finalBalances.set(user.id, netBalance);

      report += `| ${user.name} | ${formatCurrency(balance.paid)} | ${formatCurrency(balance.contributed)} | ${formatCurrency(balance.share)} | ${formatCurrency(netBalance)} |\n`;
    });
    
    // --- 4. Calculate Settlements ---
    report += `\n## Settlement\n`;

    const payers = Array.from(finalBalances.entries()).filter(([, balance]) => balance > 0).sort((a, b) => b[1] - a[1]);
    const owers = Array.from(finalBalances.entries()).filter(([, balance]) => balance < 0).sort((a, b) => a[1] - b[1]);

    let settlementSteps = '';
    let i = 0, j = 0;
    while (i < payers.length && j < owers.length) {
        const [payerId, payerAmount] = payers[i];
        const [owerId, owerAmount] = owers[j];

        const amountToSettle = Math.min(payerAmount, Math.abs(owerAmount));
        
        const owerName = typedUsers.find(u => u.id === owerId)?.name || owerId;
        const payerName = typedUsers.find(u => u.id === payerId)?.name || payerId;

        settlementSteps += `*   **${owerName}** owes **${payerName}** ${formatCurrency(amountToSettle)}.\n`;

        payers[i][1] -= amountToSettle;
        owers[j][1] += amountToSettle;

        if (Math.abs(payers[i][1]) < 0.01) i++;
        if (Math.abs(owers[j][1]) < 0.01) j++;
    }

    if (settlementSteps === '') {
        report += 'All accounts are settled. No payments are needed!';
    } else {
        report += settlementSteps;
    }

    // --- 5. Return the final structured output ---
    return {
      report,
      expenseBreakdown: finalExpenseBreakdown,
      memberContributions,
      aiSummary,
      totalContributions,
      totalExpenses,
      walletBalance,
      expensePerMember,
    };
  }
);
