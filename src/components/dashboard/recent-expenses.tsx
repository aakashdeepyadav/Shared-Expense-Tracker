import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Expense, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

type RecentExpensesProps = {
  expenses: Expense[];
  users: User[];
};

const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

export function RecentExpenses({ expenses, users }: RecentExpensesProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  userMap.set(WALLET_PAYER_ID, {
    id: WALLET_PAYER_ID,
    name: "Wallet",
    avatarUrl: "https://placehold.co/64x64/png?text=W",
    pin: "",
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-[22rem] md:max-w-none">
      <div className="space-y-2.5 md:hidden">
        {expenses.length > 0 ? (
          expenses.slice(0, 5).map((expense) => {
            const payer = userMap.get(expense.payerId);
            return (
              <div
                key={expense.id}
                className="rounded-lg border border-border/70 bg-background/70 p-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {expense.description}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(expense.date), "dd/MM/yyyy")}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold">
                    {formatCurrency(expense.amount)}
                  </p>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Avatar className="h-6 w-6 ring-1 ring-border/60">
                    <AvatarImage
                      src={payer?.avatarUrl}
                      alt={payer?.name}
                      data-ai-hint="person portrait"
                    />
                    <AvatarFallback>{payer?.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                    {payer?.name}
                  </span>
                </div>
                {expense.tags && expense.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {expense.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="px-1.5 py-0.5 text-[10px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-muted-foreground">
            No expenses available yet.
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Table className="min-w-[620px]">
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Paid by</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.length > 0 ? (
              expenses.slice(0, 5).map((expense) => {
                const payer = userMap.get(expense.payerId);
                return (
                  <TableRow
                    key={expense.id}
                    className="hover:bg-muted/35 transition-colors"
                  >
                    <TableCell>
                      <div className="font-medium">{expense.description}</div>
                      <div className="text-sm text-muted-foreground md:hidden flex flex-wrap gap-1 mt-1">
                        {expense.tags &&
                          expense.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 ring-1 ring-border/60">
                          <AvatarImage
                            src={payer?.avatarUrl}
                            alt={payer?.name}
                            data-ai-hint="person portrait"
                          />
                          <AvatarFallback>
                            {payer?.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden sm:flex flex-col gap-1.5">
                          <span>{payer?.name}</span>
                          <div className="hidden text-sm text-muted-foreground md:flex flex-wrap gap-1">
                            {expense.tags &&
                              expense.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {format(new Date(expense.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No expenses available yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
