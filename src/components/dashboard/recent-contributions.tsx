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
    <div className="w-full overflow-x-auto">
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
  );
}
