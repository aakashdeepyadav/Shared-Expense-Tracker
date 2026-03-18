import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Contribution, User } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

type RecentContributionsProps = {
  contributions: Contribution[];
  users: User[];
};

export function RecentContributions({
  contributions,
  users,
}: RecentContributionsProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <div className="mx-auto w-full min-w-0 max-w-[22rem] md:max-w-none">
      <div className="space-y-2.5 md:hidden">
        {contributions.length > 0 ? (
          contributions.slice(0, 5).map((contribution) => {
            const contributor = userMap.get(contribution.contributorId);
            return (
              <div
                key={contribution.id}
                className="rounded-lg border border-border/70 bg-background/70 p-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7 ring-1 ring-border/60">
                      <AvatarImage
                        src={contributor?.avatarUrl}
                        alt={contributor?.name}
                        data-ai-hint="person portrait"
                      />
                      <AvatarFallback>
                        {contributor?.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {contributor?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(contribution.date), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-xs font-semibold">
                    {formatCurrency(contribution.amount)}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-muted-foreground">
            No contributions available yet.
          </div>
        )}
      </div>

      <div className="hidden md:block">
        <Table className="min-w-[520px]">
          <TableHeader>
            <TableRow>
              <TableHead>Contributor</TableHead>
              <TableHead className="hidden sm:table-cell">Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contributions.length > 0 ? (
              contributions.slice(0, 5).map((contribution) => {
                const contributor = userMap.get(contribution.contributorId);
                return (
                  <TableRow
                    key={contribution.id}
                    className="hover:bg-muted/35 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8 ring-1 ring-border/60">
                          <AvatarImage
                            src={contributor?.avatarUrl}
                            alt={contributor?.name}
                            data-ai-hint="person portrait"
                          />
                          <AvatarFallback>
                            {contributor?.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{contributor?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {format(new Date(contribution.date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(contribution.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center text-muted-foreground"
                >
                  No contributions available yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
