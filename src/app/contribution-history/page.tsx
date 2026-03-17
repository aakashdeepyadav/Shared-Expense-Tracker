"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  addAdminAuditLog,
  deleteContribution,
  getMonthArchiveById,
  getMonthArchives,
  subscribeToContributions,
  subscribeToExpenses,
  subscribeToUsers,
  updateContribution,
} from "@/lib/firestore";
import type {
  Contribution,
  Expense,
  MonthArchiveSummary,
  User,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { HistoryShimmer } from "@/components/shimmers/history-shimmer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2 } from "lucide-react";

const PAGE_SIZE = 20;
const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

type MemberHistoryEntry = {
  id: string;
  actorId: string;
  amount: number;
  date: string;
  source: "wallet" | "paid-expense";
  label: string;
};

export default function ContributionHistoryPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastContribution, setLastContribution] = useState<
    Contribution | undefined
  >(undefined);
  const [archiveSummaries, setArchiveSummaries] = useState<
    MonthArchiveSummary[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [editingContribution, setEditingContribution] =
    useState<Contribution | null>(null);
  const [editContributorId, setEditContributorId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    } else if (currentUser) {
      setIsLoading(true);
      let contributionsLoaded = false;
      let expensesLoaded = false;
      const markLoaded = () => {
        if (contributionsLoaded && expensesLoaded) {
          setIsLoading(false);
        }
      };

      const unsubContributions =
        selectedPeriod === "current"
          ? subscribeToContributions(PAGE_SIZE, (newContributions) => {
              setContributions(newContributions);
              setHasMore(newContributions.length === PAGE_SIZE);
              if (newContributions.length > 0) {
                setLastContribution(
                  newContributions[newContributions.length - 1],
                );
              }
              contributionsLoaded = true;
              markLoaded();
            })
          : () => {
              // noop
            };

      const unsubExpenses =
        selectedPeriod === "current"
          ? subscribeToExpenses(PAGE_SIZE, (newExpenses) => {
              setExpenses(newExpenses);
              expensesLoaded = true;
              markLoaded();
            })
          : () => {
              // noop
            };

      if (selectedPeriod !== "current") {
        void (async () => {
          const archive = await getMonthArchiveById(selectedPeriod);
          setContributions(archive?.contributions || []);
          setExpenses(archive?.expenses || []);
          setHasMore(false);
          setLastContribution(undefined);
          setIsLoading(false);
        })();
      }

      void (async () => {
        const summaries = await getMonthArchives();
        setArchiveSummaries(summaries);
      })();

      const unsubUsers = subscribeToUsers((newUsers) => {
        setUsers(newUsers);
      });

      return () => {
        unsubContributions();
        unsubExpenses();
        unsubUsers();
      };
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router, selectedPeriod]);

  const handleLoadMore = () => {
    if (selectedPeriod !== "current") return;
    if (!hasMore || isLoadingMore || !lastContribution) return;
    setIsLoadingMore(true);

    // We create a one-time subscription to get the next page
    const unsub = subscribeToContributions(
      PAGE_SIZE,
      (newContributions) => {
        setContributions((prev) => [...prev, ...newContributions]);
        setHasMore(newContributions.length === PAGE_SIZE);
        if (newContributions.length > 0) {
          setLastContribution(newContributions[newContributions.length - 1]);
        }
        setIsLoadingMore(false);
        // Unsubscribe immediately after getting the data
        unsub();
      },
      lastContribution,
    );
  };

  const openEditDialog = (contribution: Contribution) => {
    setEditingContribution(contribution);
    setEditContributorId(contribution.contributorId);
    setEditAmount(String(contribution.amount));
    setEditDate(format(new Date(contribution.date), "yyyy-MM-dd"));
  };

  const handleSaveEdit = async () => {
    if (!editingContribution) return;

    const amount = Number(editAmount);
    if (!editContributorId || Number.isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid contribution data",
        description: "Contributor and positive amount are required.",
      });
      return;
    }

    const parsedDate = new Date(editDate);
    if (Number.isNaN(parsedDate.getTime())) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please select a valid date.",
      });
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateContribution(editingContribution.id, {
        contributorId: editContributorId,
        amount,
        date: parsedDate,
      });
      await addAdminAuditLog({
        action: "contribution.update",
        metadata: { contributionId: editingContribution.id, amount },
      });
      toast({
        title: "Contribution updated",
        description: "Contribution changes saved successfully.",
      });
      setEditingContribution(null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not update contribution.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteContribution = async (contribution: Contribution) => {
    const shouldDelete = window.confirm(
      "Delete this contribution? This cannot be undone.",
    );
    if (!shouldDelete) return;

    try {
      await deleteContribution(contribution.id);
      await addAdminAuditLog({
        action: "contribution.delete",
        metadata: {
          contributionId: contribution.id,
          amount: contribution.amount,
        },
      });
      toast({ title: "Contribution deleted" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "Could not delete contribution.",
      });
    }
  };

  const userMap = new Map(users.map((user) => [user.id, user]));

  const visibleContributions =
    isAdmin || !currentUser
      ? contributions
      : contributions.filter(
          (contribution) => contribution.contributorId === currentUser.id,
        );

  const sortedVisibleContributions = useMemo(
    () =>
      [...visibleContributions].sort((a, b) => {
        const timeDiff =
          new Date(b.date).getTime() - new Date(a.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      }),
    [visibleContributions],
  );

  const memberHistoryEntries: MemberHistoryEntry[] = currentUser
    ? [
        ...sortedVisibleContributions.map((contribution) => ({
          id: `wallet-${contribution.id}`,
          actorId: contribution.contributorId,
          amount: contribution.amount,
          date: contribution.date,
          source: "wallet" as const,
          label: "Wallet Contribution",
        })),
        ...expenses
          .filter(
            (expense) =>
              expense.payerId !== WALLET_PAYER_ID &&
              expense.payerId === currentUser.id,
          )
          .map((expense) => ({
            id: `expense-${expense.id}`,
            actorId: expense.payerId,
            amount: expense.amount,
            date: expense.date,
            source: "paid-expense" as const,
            label: expense.description || "Paid Expense",
          })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  if (isLoading) {
    return (
      <HistoryShimmer
        title="Contribution History"
        description="A list of all recorded wallet contributions."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 pb-4 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full animate-fade-up">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Contribution History
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {selectedPeriod === "current"
                ? isAdmin
                  ? "Showing current live-month wallet contributions."
                  : "Showing your wallet contributions and personally paid expenses for current month."
                : isAdmin
                  ? "Showing archived month contributions."
                  : "Showing your archived wallet contributions and paid expenses."}
            </p>
          </header>
          <div className="sticky top-2 z-20 mb-4">
            <div className="w-full md:max-w-sm rounded-xl border border-border/60 bg-background/90 p-2 shadow-sm backdrop-blur">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="h-11 w-full bg-background">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Month</SelectItem>
                  {archiveSummaries.map((archive) => (
                    <SelectItem key={archive.id} value={archive.id}>
                      {archive.periodLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Card className="modern-surface border-0 animate-soft-pop overflow-hidden">
            <CardContent className="p-0">
              <div className="md:hidden divide-y divide-border/60">
                {(
                  isAdmin
                    ? sortedVisibleContributions.length > 0
                    : memberHistoryEntries.length > 0
                ) ? (
                  (isAdmin
                    ? sortedVisibleContributions
                    : memberHistoryEntries
                  ).map((entry) => {
                    const contributor = userMap.get(
                      isAdmin
                        ? (entry as Contribution).contributorId
                        : (entry as MemberHistoryEntry).actorId,
                    );
                    const amount = isAdmin
                      ? (entry as Contribution).amount
                      : (entry as MemberHistoryEntry).amount;
                    const date = isAdmin
                      ? (entry as Contribution).date
                      : (entry as MemberHistoryEntry).date;
                    const source = isAdmin
                      ? "wallet"
                      : (entry as MemberHistoryEntry).source;
                    const label = isAdmin
                      ? "Wallet Contribution"
                      : (entry as MemberHistoryEntry).label;
                    return (
                      <div key={entry.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-7 w-7">
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
                              <p className="font-medium truncate">
                                {contributor?.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(date), "dd/MM/yyyy")}
                              </p>
                              {!isAdmin && (
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {source === "wallet"
                                      ? "Wallet"
                                      : "Paid Expense"}
                                  </Badge>
                                  {source === "paid-expense" && (
                                    <span className="truncate text-[11px] text-muted-foreground">
                                      {label}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(amount)}
                          </p>
                        </div>
                        {isAdmin && selectedPeriod === "current" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() =>
                                openEditDialog(entry as Contribution)
                              }
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() =>
                                handleDeleteContribution(entry as Contribution)
                              }
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    {isAdmin
                      ? "No contributions found."
                      : "No personal contribution or paid-expense history found."}
                  </div>
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isAdmin ? "Contributor" : "Entry"}</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {isAdmin && selectedPeriod === "current" && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(
                      isAdmin
                        ? sortedVisibleContributions.length > 0
                        : memberHistoryEntries.length > 0
                    ) ? (
                      (isAdmin
                        ? sortedVisibleContributions
                        : memberHistoryEntries
                      ).map((entry) => {
                        const contributor = userMap.get(
                          isAdmin
                            ? (entry as Contribution).contributorId
                            : (entry as MemberHistoryEntry).actorId,
                        );
                        const amount = isAdmin
                          ? (entry as Contribution).amount
                          : (entry as MemberHistoryEntry).amount;
                        const date = isAdmin
                          ? (entry as Contribution).date
                          : (entry as MemberHistoryEntry).date;
                        const source = isAdmin
                          ? "wallet"
                          : (entry as MemberHistoryEntry).source;
                        const label = isAdmin
                          ? "Wallet Contribution"
                          : (entry as MemberHistoryEntry).label;
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage
                                    src={contributor?.avatarUrl}
                                    alt={contributor?.name}
                                    data-ai-hint="person portrait"
                                  />
                                  <AvatarFallback>
                                    {contributor?.name.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-medium">
                                    {contributor?.name}
                                  </span>
                                  {!isAdmin && (
                                    <div className="mt-1 flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                      >
                                        {source === "wallet"
                                          ? "Wallet"
                                          : "Paid Expense"}
                                      </Badge>
                                      {source === "paid-expense" && (
                                        <span className="text-xs text-muted-foreground">
                                          {label}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {format(new Date(date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(amount)}
                            </TableCell>
                            {isAdmin && selectedPeriod === "current" && (
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openEditDialog(entry as Contribution)
                                    }
                                  >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      handleDeleteContribution(
                                        entry as Contribution,
                                      )
                                    }
                                  >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={
                            isAdmin && selectedPeriod === "current" ? 4 : 3
                          }
                          className="text-center text-muted-foreground py-8"
                        >
                          {isAdmin
                            ? "No contributions found."
                            : "No personal contribution or paid-expense history found."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {isAdmin && selectedPeriod === "current" && hasMore && (
              <CardFooter className="pt-6 justify-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full sm:w-auto"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        <Dialog
          open={Boolean(editingContribution)}
          onOpenChange={(open) => {
            if (!open) setEditingContribution(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit Contribution</DialogTitle>
              <DialogDescription>
                Admin can modify or delete any current-month contribution.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contributor</Label>
                <Select
                  value={editContributorId}
                  onValueChange={setEditContributorId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contributor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-contribution-amount">Amount</Label>
                  <Input
                    id="edit-contribution-amount"
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contribution-date">Date</Label>
                  <Input
                    id="edit-contribution-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingContribution(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
