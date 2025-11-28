
"use client";

import React from "react";
import { ContributionDialog } from "./contribution-dialog";
import { ExpenseDialog } from "./expense-dialog";
import { Button } from "./ui/button";
import { SidebarTrigger } from "./ui/sidebar";
import type { Expense, User } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { usePathname } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { ThemeSwitcher } from "./theme-switcher";

type PageHeaderProps = {
  onAddExpense?: (expense: Omit<Expense, 'id' | 'participants'> & { participants: string[] }) => void;
  onAddContribution?: (contribution: { contributorId: string; amount: number }) => void;
  users?: User[];
}

export function PageHeader({ onAddExpense, onAddContribution, users = [] }: PageHeaderProps) {
  const { isAdmin } = useAuth();
  const pathname = usePathname();
  const [isContributionOpen, setIsContributionOpen] = React.useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);

  const pageTitle = React.useMemo(() => {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/reports")) return "Reports";
    if (pathname.startsWith("/expense-history")) return "Expense History";
    if (pathname.startsWith("/contribution-history")) return "Contribution History";
    return "Dashboard";
  }, [pathname]);

  const canAddExpense = !!onAddExpense;
  const canAddContribution = !!onAddContribution;

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <h1 className="flex-1 text-lg font-semibold md:text-xl">{pageTitle}</h1>
      <div className="flex items-center gap-2">
        {isAdmin && pathname === "/" && (
          <div className="flex items-center gap-2">
            {canAddContribution && (
              <ContributionDialog
                open={isContributionOpen}
                onOpenChange={setIsContributionOpen}
                onAddContribution={onAddContribution!}
                users={users}
              >
                <Button size="sm" onClick={() => setIsContributionOpen(true)}>
                   <Wallet className="sm:mr-2" />
                  <span className="hidden sm:inline">Add Contribution</span>
                </Button>
              </ContributionDialog>
            )}
            
            {canAddExpense && (
              <ExpenseDialog 
                open={isExpenseOpen} 
                onOpenChange={setIsExpenseOpen} 
                onAddExpense={onAddExpense!}
                users={users}
              >
                <Button variant="outline" size="sm" onClick={() => setIsExpenseOpen(true)}>
                  <Plus className="sm:mr-2" />
                  <span className="hidden sm:inline">Add Expense</span>
                </Button>
              </ExpenseDialog>
            )}
          </div>
        )}
         <ThemeSwitcher />
      </div>
    </header>
  );
}
