"use client";

import React, { useState, useEffect } from "react";
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
  getMonthArchiveById,
  getMonthArchives,
  subscribeToExpenses,
  subscribeToUsers,
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

const PAGE_SIZE = 20;
const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

export default function ExpenseHistoryPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
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

  if (isLoading) {
    return (
      <HistoryShimmer
        title="Expense History"
        description="A list of all recorded group expenses."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader />
      <main className="flex-1 overflow-y-auto p-3 pb-4 md:p-6 md:pb-6 lg:p-8">
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
                {visibleExpenses.length > 0 ? (
                  visibleExpenses.map((expense) => {
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleExpenses.length > 0 ? (
                      visibleExpenses.map((expense) => {
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
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={4}
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
      </main>
    </div>
  );
}
