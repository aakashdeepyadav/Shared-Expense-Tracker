"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { RecentExpenses } from "@/components/dashboard/recent-expenses";
import { RecentContributions } from "@/components/dashboard/recent-contributions";
import { PageHeader } from "@/components/page-header";
import type { Expense, Contribution, User } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  addContribution,
  addExpense,
  addAdminAuditLog,
  subscribeToExpenses,
  subscribeToContributions,
  subscribeToUsers,
} from "@/lib/firestore";
import { ContributionChart } from "@/components/dashboard/contribution-chart";
import { DashboardShimmer } from "@/components/shimmers/dashboard-shimmer";
import { CalendarDays } from "lucide-react";
import { Logo } from "@/components/icons/logo";

export default function DashboardPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!isAppConfigured) {
      router.push("/setup");
      return;
    }
    if (!currentUser) {
      router.push("/login");
      return;
    }

    setIsDataLoading(true);
    let usersLoaded = false;
    let expensesLoaded = false;
    let contributionsLoaded = false;

    const checkDataLoaded = () => {
      if (usersLoaded && expensesLoaded && contributionsLoaded) {
        setIsDataLoading(false);
      }
    };

    const unsubExpenses = subscribeToExpenses(20, (newExpenses) => {
      setExpenses(newExpenses);
      expensesLoaded = true;
      checkDataLoaded();
    });

    const unsubContributions = subscribeToContributions(
      20,
      (newContributions) => {
        setContributions(newContributions);
        contributionsLoaded = true;
        checkDataLoaded();
      },
    );

    const unsubUsers = subscribeToUsers((newUsers) => {
      setUsers(newUsers);
      usersLoaded = true;
      checkDataLoaded();
    });

    return () => {
      unsubExpenses();
      unsubContributions();
      unsubUsers();
    };
  }, [currentUser, isAppConfigured, isAuthLoading, router]);

  const handleAddExpense = async (
    newExpense: Omit<Expense, "id" | "participants" | "date"> & {
      participants: string[];
      date: Date;
    },
  ) => {
    if (newExpense.participants.length === 0) return;
    const share = newExpense.amount / newExpense.participants.length;
    const expenseToAdd = {
      ...newExpense,
      participants: newExpense.participants.map((userId) => ({
        userId,
        share,
      })),
    };
    await addExpense({
      description: expenseToAdd.description,
      amount: expenseToAdd.amount,
      payerId: expenseToAdd.payerId,
      tags: expenseToAdd.tags,
      participants: expenseToAdd.participants,
      date: newExpense.date,
    });
    if (isAdmin) {
      await addAdminAuditLog({
        action: "expense.create",
        metadata: {
          payerId: expenseToAdd.payerId,
          amount: expenseToAdd.amount,
          participantCount: expenseToAdd.participants.length,
        },
      });
    }
  };

  const handleAddContribution = async (newContribution: {
    contributorId: string;
    amount: number;
  }) => {
    const contributionToAdd = {
      contributorId: newContribution.contributorId,
      amount: newContribution.amount,
      date: new Date(),
    };
    await addContribution({
      contributorId: contributionToAdd.contributorId,
      amount: contributionToAdd.amount,
      date: contributionToAdd.date,
    });
    if (isAdmin) {
      await addAdminAuditLog({
        action: "contribution.create",
        metadata: {
          contributorId: contributionToAdd.contributorId,
          amount: contributionToAdd.amount,
        },
      });
    }
  };

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

  const visibleContributions =
    isAdmin || !currentUser
      ? contributions
      : contributions.filter(
          (contribution) => contribution.contributorId === currentUser.id,
        );

  const visibleUsers =
    isAdmin || !currentUser
      ? users
      : users.filter((user) => user.id === currentUser.id);

  if (isAuthLoading) {
    return null;
  }

  if (!isAppConfigured || !currentUser) {
    return null;
  }

  if (isDataLoading) {
    return <DashboardShimmer />;
  }

  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const dotPatternLight = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%2394a3b8'/%3E%3C/svg%3E\")",
  };
  const dotPatternDark = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23475569'/%3E%3C/svg%3E\")",
  };

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        onAddExpense={handleAddExpense}
        onAddContribution={handleAddContribution}
        users={users}
      />
      <div className="relative flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:p-6 lg:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-35 dark:hidden"
          style={dotPatternLight}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block"
          style={dotPatternDark}
        />
        <div className="mx-auto w-full max-w-7xl space-y-6 animate-fade-up">
          <Card className="modern-surface border-0 overflow-hidden">
            <CardContent className="relative p-5 md:p-6">
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-2xl border border-cyan-200 bg-cyan-100/70 dark:border-cyan-900 dark:bg-cyan-950/40" />
              <div className="pointer-events-none absolute -left-6 -bottom-6 h-14 w-14 rounded-full border border-emerald-200 bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/40" />
              <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5">
                    <Logo className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-[0.08em] uppercase text-muted-foreground">
                      Shared Expense
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Financial Command Center
                  </p>
                  <h2 className="mt-2 text-2xl font-headline font-semibold tracking-tight md:text-3xl">
                    {isAdmin
                      ? `Welcome back, ${currentUser.name}`
                      : `Hello, ${currentUser.name}`}
                  </h2>
                  <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-2xl">
                    Track group spending, monitor wallet performance, and review
                    recent activity from one place.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {isAdmin ? "Admin View" : "Member View"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full px-3 py-1 border-border/70"
                  >
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    {todayLabel}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <OverviewCards
            expenses={visibleExpenses}
            contributions={visibleContributions}
            users={visibleUsers}
          />
          <div className="grid gap-6">
            <Card className="modern-surface border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl tracking-tight">
                  {isAdmin ? "Member Contributions" : "My Contributions"}
                </CardTitle>
                <CardDescription>
                  {isAdmin
                    ? "A visual breakdown of each member's total financial input (wallet contributions + expenses paid)."
                    : "A visual summary of your wallet contributions and expenses paid."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContributionChart
                  contributions={visibleContributions}
                  users={visibleUsers}
                  expenses={visibleExpenses}
                />
              </CardContent>
            </Card>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="modern-surface border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="tracking-tight">
                    Recent Expenses
                  </CardTitle>
                  <CardDescription>
                    A list of the most recent expenses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentExpenses expenses={visibleExpenses} users={users} />
                </CardContent>
              </Card>
              <Card className="modern-surface border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="tracking-tight">
                    Recent Contributions
                  </CardTitle>
                  <CardDescription>
                    Recent additions to the group wallet.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RecentContributions
                    contributions={visibleContributions}
                    users={users}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
