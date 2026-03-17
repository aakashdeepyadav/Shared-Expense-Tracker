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
    <header
      className="sticky top-0 z-10 px-2 pt-2 animate-fade-up md:px-4 md:pt-3"
      style={{
        paddingTop: "calc(0.5rem + env(safe-area-inset-top))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="mx-auto flex h-16 w-full items-center gap-3 rounded-2xl border border-white/45 bg-white/75 px-3 shadow-md backdrop-blur-md md:gap-4 md:px-6 dark:border-white/10 dark:bg-slate-900/70">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2.5 py-1">
          <Logo className="h-4 w-4" />
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
            SET
          </span>
        </div>
        <h1 className="flex-1 text-base font-semibold tracking-tight md:text-xl">
          {pageTitle}
        </h1>
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
                  <Button
                    size="sm"
                    className="shadow-sm transition-transform hover:-translate-y-0.5"
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
                    className="border-white/50 bg-white/80 shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-slate-800/60 dark:hover:bg-slate-800"
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
