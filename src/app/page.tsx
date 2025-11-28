
"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OverviewCards } from "@/components/dashboard/overview-cards";
import { RecentExpenses } from "@/components/dashboard/recent-expenses";
import { RecentContributions } from "@/components/dashboard/recent-contributions";
import { PageHeader } from "@/components/page-header";
import type { Expense, Contribution, User } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  subscribeToExpenses,
  subscribeToContributions,
  subscribeToUsers,
  addExpense,
  addContribution,
} from "@/lib/firestore";
import { ContributionChart } from "@/components/dashboard/contribution-chart";
import { DashboardShimmer } from "@/components/shimmers/dashboard-shimmer";

export default function DashboardPage() {
  const { currentUser, isAuthLoading } = useAuth();
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) {
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

    const unsubContributions = subscribeToContributions(20, (newContributions) => {
      setContributions(newContributions);
      contributionsLoaded = true;
      checkDataLoaded();
    });

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
  }, [currentUser, isAuthLoading, router]);

  const handleAddExpense = async (newExpense: Omit<Expense, 'id' | 'participants'> & { participants: string[] }) => {
    if (newExpense.participants.length === 0) return;
    const share = newExpense.amount / newExpense.participants.length;
    const expenseToAdd = {
      ...newExpense,
      participants: newExpense.participants.map(userId => ({ userId, share })),
    };
    await addExpense(expenseToAdd);
  };

  const handleAddContribution = async (newContribution: { contributorId: string; amount: number }) => {
    const contributionToAdd = {
      contributorId: newContribution.contributorId,
      amount: newContribution.amount,
      date: new Date(),
    };
    await addContribution(contributionToAdd);
  };
  
  if (isAuthLoading || !currentUser) {
    return <DashboardShimmer />;
  }

  if (isDataLoading) {
    return <DashboardShimmer />;
  }


  return (
    <div className="flex flex-col h-screen">
      <PageHeader onAddExpense={handleAddExpense} onAddContribution={handleAddContribution} users={users} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
        <OverviewCards expenses={expenses} contributions={contributions} users={users} />
        <div className="grid gap-6">
           <Card>
            <CardHeader>
              <CardTitle>Member Contributions</CardTitle>
              <CardDescription>A visual breakdown of each member's total financial input (wallet contributions + expenses paid).</CardDescription>
            </CardHeader>
            <CardContent>
              <ContributionChart contributions={contributions} users={users} expenses={expenses} />
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 gap-6">
             <Card>
              <CardHeader>
                <CardTitle>Recent Expenses</CardTitle>
                <CardDescription>
                  A list of the most recent expenses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentExpenses expenses={expenses} users={users} />
              </CardContent>
            </Card>
             <Card>
              <CardHeader>
                <CardTitle>Recent Contributions</CardTitle>
                <CardDescription>
                  Recent additions to the group wallet.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentContributions contributions={contributions} users={users} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
