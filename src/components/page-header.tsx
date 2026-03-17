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
import { Logo } from "./icons/logo";

type PageHeaderProps = {
  onAddExpense?: (
    expense: Omit<Expense, "id" | "participants" | "date"> & {
      participants: string[];
      date: Date;
    },
  ) => void | Promise<void>;
  onAddContribution?: (contribution: {
    contributorId: string;
    amount: number;
  }) => void;
  users?: User[];
};

export function PageHeader({
  onAddExpense,
  onAddContribution,
  users = [],
}: PageHeaderProps) {
  const { isAdmin } = useAuth();
  const pathname = usePathname();
  const [isContributionOpen, setIsContributionOpen] = React.useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);

  const pageTitle = React.useMemo(() => {
    if (pathname === "/") return "Dashboard";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/reports")) return "Reports";
    if (pathname.startsWith("/audit-logs")) return "Audit Logs";
    if (pathname.startsWith("/expense-history")) return "Expense History";
    if (pathname.startsWith("/contribution-history"))
      return "Contribution History";
    return "Dashboard";
  }, [pathname]);

  const canAddExpense = !!onAddExpense;
  const canAddContribution = !!onAddContribution;

  return (
    <header className="page-header-safe sticky top-0 z-30 shrink-0 pt-2 animate-fade-up md:pt-3">
      <div className="mx-auto flex h-16 min-w-0 w-full items-center gap-2 overflow-hidden rounded-2xl border border-white/45 bg-white/75 px-2.5 shadow-md backdrop-blur-md md:gap-4 md:px-6 dark:border-white/10 dark:bg-slate-900/70">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
          <Logo className="h-4 w-4" />
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            SET
          </span>
        </div>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight md:text-xl">
          {pageTitle}
        </h1>
        <div className="shrink-0 flex items-center gap-1 sm:gap-2">
          {isAdmin && pathname === "/" && (
            <div className="flex items-center gap-1 sm:gap-2">
              {canAddContribution && (
                <ContributionDialog
                  open={isContributionOpen}
                  onOpenChange={setIsContributionOpen}
                  onAddContribution={onAddContribution!}
                  users={users}
                >
                  <Button
                    size="sm"
                    className="h-8 w-8 p-0 shadow-sm transition-transform hover:-translate-y-0.5 sm:h-9 sm:w-auto sm:px-3"
                    onClick={() => setIsContributionOpen(true)}
                  >
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 border-white/50 bg-white/80 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-white sm:h-9 sm:w-auto sm:px-3 dark:border-white/15 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                    onClick={() => setIsExpenseOpen(true)}
                  >
                    <Plus className="sm:mr-2" />
                    <span className="hidden sm:inline">Add Expense</span>
                  </Button>
                </ExpenseDialog>
              )}
            </div>
          )}
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
