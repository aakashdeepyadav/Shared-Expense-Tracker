// src/ai/flows/suggest-equitable-splits.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting equitable splits of expenses among participants,
 * considering factors like vacation days, custom discounts, and past interactions. The flow defaults to an equal split if no specific recommendation is available.
 *
 * - suggestEquitableSplits - A function that suggests equitable splits of expenses.
 * - SuggestEquitableSplitsInput - The input type for the suggestEquitableSplits function.
 * - SuggestEquitableSplitsOutput - The return type for the suggestEquitableSplits function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestEquitableSplitsInputSchema = z.object({
  amount: z.number().describe('The total amount of the expense.'),
  payer: z.string().describe('The user who paid the expense.'),
  participants: z.array(z.string()).describe('The users who participated in the expense.'),
  vacationDays: z
    .record(z.string(), z.number())
    .optional()
    .describe('The number of vacation days each participant had during the expense period.'),
  customDiscounts: z
    .record(z.string(), z.number())
    .optional()
    .describe('Custom discounts for specific participants.'),
  pastInteractions: z
    .string()
    .optional()
    .describe('A summary of recent user interactions related to expenses.'),
  category: z.string().optional().describe('The category of the expense.'),
  note: z.string().optional().describe('A note about the expense.'),
});

export type SuggestEquitableSplitsInput = z.infer<typeof SuggestEquitableSplitsInputSchema>;

const SuggestEquitableSplitsOutputSchema = z.record(z.string(), z.number()).describe(
  'A record of user IDs to split amounts, representing the suggested equitable split. The sum of all splits should equal the input amount.'
);

export type SuggestEquitableSplitsOutput = z.infer<typeof SuggestEquitableSplitsOutputSchema>;

export async function suggestEquitableSplits(
  input: SuggestEquitableSplitsInput
): Promise<SuggestEquitableSplitsOutput> {
  return suggestEquitableSplitsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestEquitableSplitsPrompt',
  input: {schema: SuggestEquitableSplitsInputSchema},
  output: {schema: SuggestEquitableSplitsOutputSchema},
  prompt: `You are an AI assistant that suggests how to split expenses fairly among a group of people.

  Consider the following factors when determining the split:

  - The total amount of the expense: {{{amount}}}
  - Who paid the expense: {{{payer}}}
  - Who participated in the expense: {{participants}}
  {{#if vacationDays}}
  - Vacation days each participant had during the expense period: {{vacationDays}}
  {{/if}}
  {{#if customDiscounts}}
  - Custom discounts for specific participants: {{customDiscounts}}
  {{/if}}
  {{#if pastInteractions}}
  - A summary of recent user interactions related to expenses: {{pastInteractions}}
  {{/if}}
  {{#if category}}
  - The category of the expense: {{category}}
  {{/if}}
  {{#if note}}
  - A note about the expense: {{note}}
  {{/if}}

  Return a JSON object where the keys are user IDs and the values are the amount each user should pay. If no specific recommendation can be determined, split the expense equally among the participants. The sum of all splits should equal the input amount.
  `,
});

const suggestEquitableSplitsFlow = ai.defineFlow(
  {
    name: 'suggestEquitableSplitsFlow',
    inputSchema: SuggestEquitableSplitsInputSchema,
    outputSchema: SuggestEquitableSplitsOutputSchema,
  },
  async input => {
    try {
      const {output} = await prompt(input);
      return output!;
    } catch (e) {
      // If the prompt fails, default to an equal split.
      const equalSplit = input.amount / input.participants.length;
      const split: SuggestEquitableSplitsOutput = {};
      input.participants.forEach(participant => (split[participant] = equalSplit));
      return split;
    }
  }
);
