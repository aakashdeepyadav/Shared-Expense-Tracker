"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  addAdminAuditLog,
  deleteExpense,
  getMonthArchiveById,
  getMonthArchives,
  subscribeToExpenses,
  subscribeToUsers,
  updateExpense,
} from "@/lib/firestore";
import type { Expense, MonthArchiveSummary, User } from "@/lib/types";
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

export default function ExpenseHistoryPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastExpense, setLastExpense] = useState<Expense | undefined>(
    undefined,
  );
  const [archiveSummaries, setArchiveSummaries] = useState<
    MonthArchiveSummary[]
  >([]);
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editPayerId, setEditPayerId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAppConfigured) {
      router.push("/setup");
    } else if (!currentUser) {
      router.push("/login");
    } else {
      setIsLoading(true);
      const unsubExpenses =
        selectedPeriod === "current"
          ? subscribeToExpenses(PAGE_SIZE, (newExpenses) => {
              setExpenses(newExpenses);
              setHasMore(newExpenses.length === PAGE_SIZE);
              if (newExpenses.length > 0) {
                setLastExpense(newExpenses[newExpenses.length - 1]);
              }
              setIsLoading(false);
            })
          : () => {};

      if (selectedPeriod !== "current") {
        void (async () => {
          const archive = await getMonthArchiveById(selectedPeriod);
          setExpenses(archive?.expenses || []);
          setHasMore(false);
          setLastExpense(undefined);
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
        unsubExpenses();
        unsubUsers();
      };
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router, selectedPeriod]);

  const handleLoadMore = () => {
    if (selectedPeriod !== "current") return;
    if (!hasMore || isLoadingMore || !lastExpense) return;
    setIsLoadingMore(true);

    const unsub = subscribeToExpenses(
      PAGE_SIZE,
      (newExpenses) => {
        setExpenses((prev) => [...prev, ...newExpenses]);
        setHasMore(newExpenses.length === PAGE_SIZE);
        if (newExpenses.length > 0) {
          setLastExpense(newExpenses[newExpenses.length - 1]);
        }
        setIsLoadingMore(false);
        unsub();
      },
      lastExpense,
    );
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setEditDescription(expense.description);
    setEditAmount(String(expense.amount));
    setEditPayerId(expense.payerId);
    setEditDate(format(new Date(expense.date), "yyyy-MM-dd"));
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;

    const amount = Number(editAmount);
    if (!editDescription.trim() || Number.isNaN(amount) || amount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid expense data",
        description: "Description and a positive amount are required.",
      });
      return;
    }

    if (!editPayerId) {
      toast({
        variant: "destructive",
        title: "Select payer",
        description: "Please select who paid this expense.",
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
      await updateExpense(editingExpense.id, {
        description: editDescription.trim(),
        amount,
        payerId: editPayerId,
        date: parsedDate,
      });
      await addAdminAuditLog({
        action: "expense.update",
        metadata: { expenseId: editingExpense.id, amount },
      });
      toast({
        title: "Expense updated",
        description: "Expense changes saved successfully.",
      });
      setEditingExpense(null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "Could not update expense.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    const shouldDelete = window.confirm(
      `Delete expense \"${expense.description}\"? This cannot be undone.`,
    );
    if (!shouldDelete) return;

    try {
      await deleteExpense(expense.id);
      await addAdminAuditLog({
        action: "expense.delete",
        metadata: { expenseId: expense.id, amount: expense.amount },
      });
      toast({ title: "Expense deleted" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description:
          error instanceof Error ? error.message : "Could not delete expense.",
      });
    }
  };

  const userMap = new Map(users.map((user) => [user.id, user]));
  userMap.set(WALLET_PAYER_ID, {
    id: WALLET_PAYER_ID,
    name: "Wallet",
    avatarUrl: "https://placehold.co/64x64/png?text=W",
    pin: "",
  });

  const visibleExpenses =
    isAdmin || !currentUser
      ? expenses
      : expenses.filter(
          (expense) =>
            expense.payerId === currentUser.id ||
            expense.participants.some(
              (participant) => participant.userId === currentUser.id,
            ),
        );

  const sortedVisibleExpenses = useMemo(
    () =>
      [...visibleExpenses].sort((a, b) => {
        const timeDiff =
          new Date(b.date).getTime() - new Date(a.date).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      }),
    [visibleExpenses],
  );

  if (isLoading) {
    return (
      <HistoryShimmer
        title="Expense History"
        description="A list of all recorded group expenses."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader />
      <main className="flex-1 min-h-0 overflow-y-auto p-3 pb-4 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full max-w-6xl animate-fade-up">
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Expense History
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {selectedPeriod === "current"
                ? "Showing current live-month expenses."
                : "Showing archived month expenses."}
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
                {sortedVisibleExpenses.length > 0 ? (
                  sortedVisibleExpenses.map((expense) => {
                    const payer = userMap.get(expense.payerId);
                    return (
                      <div key={expense.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {expense.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(expense.date), "dd/MM/yyyy")}
                            </p>
                          </div>
                          <p className="text-sm font-semibold whitespace-nowrap">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={payer?.avatarUrl}
                              alt={payer?.name}
                              data-ai-hint="person portrait"
                            />
                            <AvatarFallback>
                              {payer?.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground truncate">
                            Paid by {payer?.name}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {expense.tags && expense.tags.length > 0 ? (
                            expense.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-[11px]"
                              >
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-[11px]">
                              Uncategorized
                            </Badge>
                          )}
                        </div>
                        {isAdmin && selectedPeriod === "current" && (
                          <div className="mt-3 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => openEditDialog(expense)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-8"
                              onClick={() => handleDeleteExpense(expense)}
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
                      ? "No expenses found."
                      : "No personal expenses found."}
                  </div>
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <Table className="min-w-[540px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Paid by</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Date
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {isAdmin && selectedPeriod === "current" && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVisibleExpenses.length > 0 ? (
                      sortedVisibleExpenses.map((expense) => {
                        const payer = userMap.get(expense.payerId);
                        return (
                          <TableRow key={expense.id}>
                            <TableCell>
                              <div className="font-medium max-w-[10rem] sm:max-w-none truncate">
                                {expense.description}
                              </div>
                              <div className="text-sm text-muted-foreground sm:hidden flex flex-wrap gap-1 mt-1">
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
                                <Avatar className="h-8 w-8">
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
                                  <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
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
                            <TableCell className="hidden md:table-cell">
                              {format(new Date(expense.date), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                            {isAdmin && selectedPeriod === "current" && (
                              <TableCell className="text-right">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditDialog(expense)}
                                  >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteExpense(expense)}
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
                            isAdmin && selectedPeriod === "current" ? 5 : 4
                          }
                          className="text-center text-muted-foreground py-8"
                        >
                          {isAdmin
                            ? "No expenses found."
                            : "No personal expenses found."}
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
          open={Boolean(editingExpense)}
          onOpenChange={(open) => {
            if (!open) setEditingExpense(null);
          }}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>
                Admin can modify or delete any current-month expense.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-expense-description">Description</Label>
                <Input
                  id="edit-expense-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-expense-amount">Amount</Label>
                  <Input
                    id="edit-expense-amount"
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expense-date">Date</Label>
                  <Input
                    id="edit-expense-date"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Paid by</Label>
                <Select value={editPayerId} onValueChange={setEditPayerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WALLET_PAYER_ID}>Wallet</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingExpense(null)}
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
