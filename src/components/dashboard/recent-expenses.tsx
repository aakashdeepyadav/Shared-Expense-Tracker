
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
}

export function RecentExpenses({ expenses, users }: RecentExpensesProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  userMap.set("tifresh", { id: "tifresh", name: "TiFresh", avatarUrl: "https://raw.githubusercontent.com/skyworld-play/tifresh-app/refs/heads/main/tifresh.png" });


  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Paid by</TableHead>
            <TableHead className="hidden md:table-cell">Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.slice(0, 5).map((expense) => {
            const payer = userMap.get(expense.payerId);
            return (
              <TableRow key={expense.id}>
                <TableCell>
                  <div className="font-medium">{expense.description}</div>
                  <div className="text-sm text-muted-foreground md:hidden flex flex-wrap gap-1 mt-1">
                     {expense.tags && expense.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={payer?.avatarUrl} alt={payer?.name} data-ai-hint="person portrait" />
                      <AvatarFallback>{payer?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:flex flex-col gap-1.5">
                        <span>{payer?.name}</span>
                        <div className="hidden text-sm text-muted-foreground md:flex flex-wrap gap-1">
                            {expense.tags && expense.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                        </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {format(new Date(expense.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(expense.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
