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
};

function buildClientReport(
  users: User[],
  expenses: Expense[],
  contributions: Contribution[],
): GenerateReportOutput {
  const totalContributions = contributions.reduce(
    (acc, c) => acc + c.amount,
    0,
  );
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const walletBalance = totalContributions - totalExpenses;
  const expensePerMember = users.length > 0 ? totalExpenses / users.length : 0;

  const breakdownMap = new Map<string, number>();
  expenses.forEach((expense) => {
    expense.tags.forEach((tag) => {
      breakdownMap.set(tag, (breakdownMap.get(tag) || 0) + expense.amount);
    });
  });
  const expenseBreakdown = Array.from(breakdownMap, ([category, total]) => ({
    category,
    total,
  }));

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

  const memberContributions = users
    .map((user) => {
      const balance = memberBalances.get(user.id) || {
        paid: 0,
        share: 0,
        contributed: 0,
      };
      return {
        name: user.name,
        total: balance.paid + balance.contributed,
      };
    })
    .filter((entry) => entry.total > 0);

  const netBalances = new Map<string, number>();
  let report = `
## Member Summary
| Member | Expenses Paid | Wallet Contributions | Share of Expenses | Net Balance |
| :--- | :---: | :---: | :---: | :---: |
`;

  users.forEach((user) => {
    const balance = memberBalances.get(user.id) || {
      paid: 0,
      share: 0,
      contributed: 0,
    };
    const netBalance = balance.paid + balance.contributed - balance.share;
    netBalances.set(user.id, netBalance);

    report += `| ${user.name} | ${formatCurrency(balance.paid)} | ${formatCurrency(
      balance.contributed,
    )} | ${formatCurrency(balance.share)} | ${formatCurrency(netBalance)} |\n`;
  });

  report += "\n## Settlement\n";

  const payers = Array.from(netBalances.entries())
    .filter(([, balance]) => balance > 0)
    .sort((a, b) => b[1] - a[1]);
  const owers = Array.from(netBalances.entries())
    .filter(([, balance]) => balance < 0)
    .sort((a, b) => a[1] - b[1]);

  let settlementSteps = "";
  let i = 0;
  let j = 0;

  while (i < payers.length && j < owers.length) {
    const [payerId, payerAmount] = payers[i];
    const [owerId, owerAmount] = owers[j];
    const amountToSettle = Math.min(payerAmount, Math.abs(owerAmount));

    const payerName = users.find((u) => u.id === payerId)?.name || payerId;
    const owerName = users.find((u) => u.id === owerId)?.name || owerId;
    settlementSteps += `*   **${owerName}** owes **${payerName}** ${formatCurrency(amountToSettle)}.\n`;

    payers[i][1] -= amountToSettle;
    owers[j][1] += amountToSettle;

    if (Math.abs(payers[i][1]) < 0.01) i += 1;
    if (Math.abs(owers[j][1]) < 0.01) j += 1;
  }

  if (settlementSteps) {
    report += settlementSteps;
  } else {
    report += "All accounts are settled. No payments are needed!";
  }

  const aiSummary =
    walletBalance >= 0
      ? "Overall, spending is controlled and the wallet remains healthy for the period."
      : "Overall, group spending exceeded contributions this period, so adding wallet contributions is recommended.";

  return {
    report,
    expenseBreakdown,
    memberContributions,
    aiSummary,
    totalContributions,
    totalExpenses,
    walletBalance,
    expensePerMember,
  };
}

export default function ReportsPage() {
  const { currentUser, isAdmin, isAuthLoading, isAppConfigured } = useAuth();
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

  return (
    <div className="p-4 md:p-6 lg:p-8 @container animate-fade-up">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between gap-4 mb-6 print:hidden">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Reports
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Generate and view a detailed financial summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-2 @lg:mt-0">
            <Button onClick={handleGenerateReport} disabled={isLoading}>
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
              <Button variant="outline" onClick={handlePrint}>
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
              <div className="hidden print:block mb-8">
                <div className="flex items-center gap-4">
                  <Logo className="h-16 w-16" />
                  <div>
                    <h1 className="text-3xl font-bold m-0">
                      Shared Expense Tracker
                    </h1>
                    <p className="text-muted-foreground m-0">
                      Financial Report
                    </p>
                  </div>
                </div>
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
                      className="w-full h-[250px] lg:h-[300px]"
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
                              fontSize: 12,
                            }}
                            tickMargin={10}
                            width={80}
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
                <CardContent className="pt-6">
                  <article className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:tracking-tight prose-p:leading-relaxed">
                    <ReactMarkdown>{reportData.report}</ReactMarkdown>
                  </article>
                </CardContent>
              </Card>
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
              padding: 1rem;
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
          }
          .prose table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1em;
            margin-bottom: 1em;
          }
          .prose th,
          .prose td {
            border: 1px solid hsl(var(--border));
            padding: 0.5em 1em;
          }
          .prose thead {
            background-color: hsl(var(--muted));
          }
          .prose thead th {
            font-weight: 600;
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
