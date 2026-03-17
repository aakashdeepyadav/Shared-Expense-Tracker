"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileDown,
  BarChart2,
  Wallet,
  Users,
  Landmark,
  IndianRupee,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/icons/logo";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { DashboardShimmer } from "@/components/shimmers/dashboard-shimmer";
import {
  addAdminAuditLog,
  getAllContributionsForReport,
  getAllExpensesForReport,
  getAllUsers,
} from "@/lib/firestore";
import type { Contribution, Expense, User } from "@/lib/types";

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

type GenerateReportOutput = {
  report: string;
  expenseBreakdown: { category: string; total: number }[];
  memberContributions: { name: string; total: number }[];
  aiSummary: string;
  totalContributions: number;
  totalExpenses: number;
  walletBalance: number;
  expensePerMember: number;
  generatedAt: string;
  periodLabel: string;
};

function buildClientReport(
  users: User[],
  expenses: Expense[],
  contributions: Contribution[],
): GenerateReportOutput {
  const generatedAt = new Date().toLocaleString("en-IN");
  const totalContributions = contributions.reduce(
    (acc, c) => acc + c.amount,
    0,
  );
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const walletBalance = totalContributions - totalExpenses;
  const expensePerMember = users.length > 0 ? totalExpenses / users.length : 0;

  const breakdownMap = new Map<string, number>();
  expenses.forEach((expense) => {
    const tags = expense.tags?.length ? expense.tags : ["Uncategorized"];
    tags.forEach((tag) => {
      breakdownMap.set(tag, (breakdownMap.get(tag) || 0) + expense.amount);
    });
  });
  const expenseBreakdown = Array.from(breakdownMap, ([category, total]) => ({
    category,
    total,
  })).sort((a, b) => b.total - a.total);

  const memberBalances = new Map<
    string,
    { paid: number; share: number; contributed: number }
  >();
  users.forEach((user) =>
    memberBalances.set(user.id, { paid: 0, share: 0, contributed: 0 }),
  );

  contributions.forEach((contribution) => {
    const entry = memberBalances.get(contribution.contributorId);
    if (entry) {
      entry.contributed += contribution.amount;
    }
  });

  expenses.forEach((expense) => {
    if (expense.payerId !== WALLET_PAYER_ID) {
      const payer = memberBalances.get(expense.payerId);
      if (payer) {
        payer.paid += expense.amount;
      }
    }
    expense.participants.forEach((participant) => {
      const entry = memberBalances.get(participant.userId);
      if (entry) {
        entry.share += participant.share;
      }
    });
  });

  const memberRows = users
    .map((user) => {
      const balance = memberBalances.get(user.id) || {
        paid: 0,
        share: 0,
        contributed: 0,
      };
      const netBalance = balance.paid + balance.contributed - balance.share;
      return {
        id: user.id,
        name: user.name,
        paid: balance.paid,
        contributed: balance.contributed,
        share: balance.share,
        netBalance,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const memberContributions = memberRows
    .map((row) => ({ name: row.name, total: row.paid + row.contributed }))
    .filter((entry) => entry.total > 0);

  const netBalances = new Map<string, number>();
  memberRows.forEach((row) => {
    netBalances.set(row.id, row.netBalance);
  });

  const allDates = [
    ...expenses.map((entry) => new Date(entry.date)),
    ...contributions.map((entry) => new Date(entry.date)),
  ].filter((date) => !Number.isNaN(date.getTime()));

  const periodStart =
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : null;
  const periodEnd =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : null;

  const payers = Array.from(netBalances.entries())
    .filter(([, balance]) => balance > 0)
    .sort((a, b) => b[1] - a[1]);
  const owers = Array.from(netBalances.entries())
    .filter(([, balance]) => balance < 0)
    .sort((a, b) => a[1] - b[1]);

  const settlementRows: Array<{ from: string; to: string; amount: number }> =
    [];
  let i = 0;
  let j = 0;

  while (i < payers.length && j < owers.length) {
    const [payerId, payerAmount] = payers[i];
    const [owerId, owerAmount] = owers[j];
    const amountToSettle = Math.min(payerAmount, Math.abs(owerAmount));

    const payerName = users.find((u) => u.id === payerId)?.name || payerId;
    const owerName = users.find((u) => u.id === owerId)?.name || owerId;
    settlementRows.push({
      from: owerName,
      to: payerName,
      amount: amountToSettle,
    });

    payers[i][1] -= amountToSettle;
    owers[j][1] += amountToSettle;

    if (Math.abs(payers[i][1]) < 0.01) i += 1;
    if (Math.abs(owers[j][1]) < 0.01) j += 1;
  }

  const periodLabel =
    periodStart && periodEnd
      ? `${periodStart.toLocaleDateString("en-IN")} - ${periodEnd.toLocaleDateString("en-IN")}`
      : "No financial activity recorded";

  let report = `# Group Financial Report\n\n`;
  report += `**Generated on:** ${generatedAt}  \n`;
  report += `**Reporting period:** ${periodLabel}\n\n`;

  report += `## Executive Summary\n`;
  report += `- Members: **${users.length}**\n`;
  report += `- Total expenses: **${formatCurrency(totalExpenses)}**\n`;
  report += `- Total wallet contributions: **${formatCurrency(totalContributions)}**\n`;
  report += `- Net wallet position: **${formatCurrency(walletBalance)}**\n\n`;

  report += `## Key Metrics\n`;
  report += `| Metric | Value |\n`;
  report += `| :--- | ---: |\n`;
  report += `| Total Members | ${users.length} |\n`;
  report += `| Total Expenses | ${formatCurrency(totalExpenses)} |\n`;
  report += `| Total Contributions | ${formatCurrency(totalContributions)} |\n`;
  report += `| Average Expense per Member | ${formatCurrency(expensePerMember)} |\n`;
  report += `| Wallet Balance | ${formatCurrency(walletBalance)} |\n\n`;

  report += `## Expense Category Breakdown\n`;
  if (expenseBreakdown.length > 0 && totalExpenses > 0) {
    report += `| Category | Amount | Share |\n`;
    report += `| :--- | ---: | ---: |\n`;
    expenseBreakdown.forEach((item) => {
      const share = (item.total / totalExpenses) * 100;
      report += `| ${item.category} | ${formatCurrency(item.total)} | ${share.toFixed(1)}% |\n`;
    });
  } else {
    report += `No categorized expenses available for this period.\n`;
  }

  report += `\n## Member Financial Position\n`;
  report += `| Member | Expenses Paid | Wallet Contributions | Expense Share | Net Position |\n`;
  report += `| :--- | ---: | ---: | ---: | ---: |\n`;
  memberRows.forEach((row) => {
    report += `| ${row.name} | ${formatCurrency(row.paid)} | ${formatCurrency(row.contributed)} | ${formatCurrency(row.share)} | ${formatCurrency(row.netBalance)} |\n`;
  });

  report += `\n## Settlement Recommendations\n`;
  if (settlementRows.length > 0) {
    report += `| # | Debtor | Creditor | Amount |\n`;
    report += `| ---: | :--- | :--- | ---: |\n`;
    settlementRows.forEach((row, index) => {
      report += `| ${index + 1} | ${row.from} | ${row.to} | ${formatCurrency(row.amount)} |\n`;
    });
  } else {
    report += `All accounts are settled. No pending transfers are required.\n`;
  }

  const aiSummary =
    walletBalance >= 0
      ? "Financial performance is stable. Contributions adequately cover spending in the selected period."
      : "Spending exceeded available contributions. Additional wallet funding is recommended to restore a positive balance.";

  return {
    report,
    expenseBreakdown,
    memberContributions,
    aiSummary,
    totalContributions,
    totalExpenses,
    walletBalance,
    expensePerMember,
    generatedAt,
    periodLabel,
  };
}

export default function ReportsPage() {
  const {
    currentUser,
    isAdmin,
    isAuthLoading,
    isAppConfigured,
    appConfig,
    activeGroupId,
  } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<GenerateReportOutput | null>(
    null,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    } else if (!isAuthLoading && currentUser && !isAdmin) {
      router.push("/");
    }
  }, [currentUser, isAdmin, isAppConfigured, isAuthLoading, router]);

  if (isAuthLoading || !currentUser || !isAdmin) {
    return <DashboardShimmer />;
  }

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setReportData(null);
    try {
      const [users, expenses, contributions] = await Promise.all([
        getAllUsers(),
        getAllExpensesForReport(),
        getAllContributionsForReport(),
      ]);

      const result = buildClientReport(users, expenses, contributions);
      setReportData(result);
      await addAdminAuditLog({
        action: "report.generate",
        metadata: {
          userCount: users.length,
          expenseCount: expenses.length,
          contributionCount: contributions.length,
        },
      });
      toast({
        title: "Report Generated",
        description: "Your financial report has been successfully created.",
      });
    } catch (error) {
      console.error("Report generation error:", error);
      toast({
        variant: "destructive",
        title: "Error Generating Report",
        description: "An unexpected error occurred. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const chartData =
    reportData?.memberContributions?.map((item, index) => ({
      ...item,
      fill: chartColors[index % chartColors.length],
    })) || [];

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.name] = {
      label: item.name,
      color: item.fill,
    };
    return acc;
  }, {} as ChartConfig);

  const displayGroupName = appConfig?.groupName || "Shared Expense Tracker";
  const displayGroupId = appConfig?.groupId || activeGroupId || "N/A";

  return (
    <div className="p-3 md:p-6 lg:p-8 @container animate-fade-up">
      <div className="mx-auto w-full">
        <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between gap-4 mb-6 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Reports
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Generate and view a detailed financial summary.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-2 @lg:mt-0 w-full @lg:w-auto">
            <Button
              onClick={handleGenerateReport}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </Button>
            {reportData && (
              <Button
                variant="outline"
                onClick={handlePrint}
                className="w-full sm:w-auto"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Save as PDF
              </Button>
            )}
          </div>
        </div>

        <div id="report-content" className="space-y-6 stagger-children">
          {isLoading && (
            <Card className="modern-surface border-0 animate-soft-pop">
              <CardContent className="flex flex-col items-center justify-center text-center p-8 md:p-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-semibold">Analyzing your data...</p>
                <p className="text-muted-foreground">This may take a moment.</p>
              </CardContent>
            </Card>
          )}

          {reportData && (
            <>
              <div className="hidden print:block mb-6 print-report-header">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Logo className="h-14 w-14" />
                    <div>
                      <h1 className="text-2xl font-bold m-0 leading-tight">
                        Shared Expense Tracker
                      </h1>
                      <p className="text-muted-foreground m-0 text-sm">
                        Financial Statement
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="m-0 text-right text-sm font-medium">
                      {displayGroupName}
                    </p>
                    <p className="m-0 text-right text-xs text-muted-foreground">
                      Group ID: {displayGroupId}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <p className="m-0">
                    <span className="font-medium text-foreground">Period:</span>{" "}
                    {reportData.periodLabel}
                  </p>
                  <p className="m-0 sm:text-right">
                    <span className="font-medium text-foreground">
                      Generated:
                    </span>{" "}
                    {reportData.generatedAt}
                  </p>
                </div>
                <div className="mt-3 border-t border-border" />
              </div>

              <div className="print:hidden">
                <h1 className="text-2xl font-bold font-headline mb-2">
                  Financial Report
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                  {reportData.aiSummary}
                </p>
              </div>

              <Card className="modern-surface border-0">
                <CardHeader>
                  <CardTitle>Overall Financial Health</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Landmark className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Total Wallet Contributions
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(reportData.totalContributions)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <IndianRupee className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Total Group Spending
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(reportData.totalExpenses)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Expense per Member
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(reportData.expensePerMember)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg">
                      <Wallet className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        Final Wallet Balance
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(reportData.walletBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {chartData.length > 0 && (
                <Card className="modern-surface border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart2 className="h-5 w-5" />
                      Member Contributions
                    </CardTitle>
                    <CardDescription>
                      Total financial input (wallet contributions + expenses
                      paid) by each member.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pl-0 pr-0 md:pr-6">
                    <ChartContainer
                      config={chartConfig}
                      className="w-full h-[220px] sm:h-[250px] lg:h-[300px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          accessibilityLayer
                          data={chartData}
                          layout="vertical"
                          margin={{ left: 10, right: 30 }}
                        >
                          <YAxis
                            dataKey="name"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            tick={{
                              fill: "hsl(var(--foreground))",
                              fontSize: 11,
                            }}
                            tickMargin={10}
                            width={72}
                          />
                          <XAxis dataKey="total" type="number" hide />
                          <ChartTooltip
                            cursor={false}
                            content={
                              <ChartTooltipContent
                                formatter={(value) =>
                                  formatCurrency(value as number)
                                }
                                indicator="line"
                              />
                            }
                          />
                          <Bar dataKey="total" layout="vertical" radius={5}>
                            {chartData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                            <LabelList
                              dataKey="total"
                              position="insideRight"
                              offset={8}
                              className="fill-primary-foreground font-semibold"
                              formatter={(value: number) =>
                                formatCurrency(value)
                              }
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}

              <Card className="modern-surface border-0 print:shadow-none print:border-none">
                <CardContent className="pt-5 md:pt-6">
                  <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:leading-relaxed prose-th:text-xs prose-td:text-xs md:prose-th:text-sm md:prose-td:text-sm">
                    <ReactMarkdown>{reportData.report}</ReactMarkdown>
                  </article>
                </CardContent>
              </Card>

              <div className="hidden print:flex print-report-footer items-center justify-between text-[10px] text-muted-foreground">
                <p className="m-0">
                  Confidential internal report • {displayGroupName}
                </p>
                <p className="m-0">Generated: {reportData.generatedAt}</p>
                <p className="m-0 print-page-number" />
              </div>
            </>
          )}

          {!isLoading && !reportData && (
            <Card className="modern-surface border-0 animate-soft-pop">
              <CardHeader>
                <CardTitle>Financial Report</CardTitle>
                <CardDescription>
                  Click Generate Report to get started.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center p-10 text-muted-foreground print:hidden">
                  Your report will be displayed here once generated.
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 16mm;
            }
            body * {
              visibility: hidden;
            }
            #report-content,
            #report-content * {
              visibility: visible;
            }
            #report-content {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              padding-bottom: 1.6rem;
            }
            .prose {
              font-size: 12px;
            }
            .prose h1,
            .prose h2,
            .prose h3 {
              margin-top: 1.2em;
              margin-bottom: 0.5em;
            }
            .print-report-header {
              break-after: avoid;
            }
            .print-report-footer {
              position: fixed;
              left: 0;
              right: 0;
              bottom: 0;
              border-top: 1px solid hsl(var(--border));
              background: hsl(var(--background));
              padding-top: 0.25rem;
            }
            .print-page-number::before {
              content: "Page " counter(page);
            }
          }
          .prose table {
            width: 100%;
            display: block;
            overflow-x: auto;
            white-space: nowrap;
            border-collapse: collapse;
            margin-top: 1em;
            margin-bottom: 1em;
          }
          .prose th,
          .prose td {
            border: 1px solid hsl(var(--border));
            padding: 0.45em 0.75em;
          }
          .prose thead {
            background-color: hsl(var(--muted));
          }
          .prose thead th {
            font-weight: 600;
          }
          @media (min-width: 768px) {
            .prose table {
              display: table;
              white-space: normal;
            }
            .prose th,
            .prose td {
              padding: 0.5em 1em;
            }
          }
          @media print {
            .prose table {
              display: table;
              overflow: visible;
              white-space: normal;
            }
          }
          .prose a {
            color: inherit;
            text-decoration: none;
          }
        `}</style>
      </div>
    </div>
  );
}
