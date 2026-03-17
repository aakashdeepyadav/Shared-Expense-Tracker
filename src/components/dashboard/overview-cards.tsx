import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Wallet,
  IndianRupee,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { Expense, Contribution, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

type OverviewCardsProps = {
  expenses: Expense[];
  contributions: Contribution[];
  users: User[];
};

export function OverviewCards({
  expenses,
  contributions,
  users,
}: OverviewCardsProps) {
  const { currentUser, isAdmin } = useAuth();

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  const totalContributions = contributions.reduce(
    (sum, contr) => sum + contr.amount,
    0,
  );

  const walletExpenses = expenses
    .filter((expense) => expense.payerId === WALLET_PAYER_ID)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const myWalletContributions = contributions
    .filter((c) => c.contributorId === currentUser?.id)
    .reduce((sum, c) => sum + c.amount, 0);

  const myPaidExpenses = expenses
    .filter(
      (expense) =>
        expense.payerId !== WALLET_PAYER_ID &&
        expense.payerId === currentUser?.id,
    )
    .reduce((sum, expense) => sum + expense.amount, 0);

  const myContributions = myWalletContributions + myPaidExpenses;

  const walletBalance = totalContributions - walletExpenses;

  const memberExpenseShareTotals = new Map<string, number>();
  users.forEach((user) => memberExpenseShareTotals.set(user.id, 0));

  expenses.forEach((expense) => {
    const participantCount = expense.participants.length;
    if (participantCount === 0) return;

    const normalizedShare = expense.amount / participantCount;
    expense.participants.forEach((participant) => {
      const current = memberExpenseShareTotals.get(participant.userId) || 0;
      memberExpenseShareTotals.set(
        participant.userId,
        current + normalizedShare,
      );
    });
  });

  const totalParticipantExpenseShares = Array.from(
    memberExpenseShareTotals.values(),
  ).reduce((sum, value) => sum + value, 0);

  const expensePerMember =
    users.length > 0 ? totalParticipantExpenseShares / users.length : 0;

  const walletStatusLabel =
    walletBalance >= 0 ? "Healthy wallet" : "Deficit alert";

  const cards = [
    {
      title: "Total Expenses",
      value: formatCurrency(totalExpenses),
      detail: "Recorded spending this cycle",
      icon: IndianRupee,
      positive: true,
    },
    {
      title: "Group Wallet",
      value: formatCurrency(walletBalance),
      detail: walletStatusLabel,
      icon: Wallet,
      highlight: walletBalance < 0,
      positive: walletBalance >= 0,
    },
    {
      title: "Expense per Member",
      value: formatCurrency(expensePerMember),
      detail: "Average individual burden",
      icon: Users,
      positive: true,
    },
  ];

  if (!isAdmin) {
    cards.push({
      title: "My Contributions",
      value: formatCurrency(myContributions),
      detail: "Wallet top-ups + personally paid expenses",
      icon: PiggyBank,
      positive: true,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.title}
            className="modern-surface border-0 overflow-hidden animate-soft-pop transition-transform hover:-translate-y-0.5"
          >
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline tracking-tight">
                {card.value}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                {card.positive ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                )}
                <p
                  className={
                    !card.positive
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {card.detail}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
