
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Wallet } from "lucide-react";
import type { Expense, Contribution, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";

type OverviewCardsProps = {
  expenses: Expense[];
  contributions: Contribution[];
  users: User[];
}

export function OverviewCards({ expenses, contributions, users }: OverviewCardsProps) {
  const { currentUser, isAdmin } = useAuth();
  
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  const totalContributions = contributions.reduce(
    (sum, contr) => sum + contr.amount,
    0
  );
  
  const myContributions = contributions
    .filter(c => c.contributorId === currentUser?.id)
    .reduce((sum, c) => sum + c.amount, 0);

  const walletBalance = totalContributions - totalExpenses;

  const expensePerMember = users.length > 0 ? totalExpenses / users.length : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
          <span className="h-4 w-4 text-muted-foreground">₹</span>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-headline">
            {formatCurrency(totalExpenses)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total expenses recorded this cycle
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Group Wallet</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-headline">
            {formatCurrency(walletBalance)}
          </div>
          <p className="text-xs text-muted-foreground">
            Remaining balance in the shared wallet
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Expense per Member</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-headline">
            {formatCurrency(expensePerMember)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average expense per member
          </p>
        </CardContent>
      </Card>
      {!isAdmin && (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Contributions</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold font-headline">
                {formatCurrency(myContributions)}
            </div>
            <p className="text-xs text-muted-foreground">
                Total you have added to the wallet
            </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
