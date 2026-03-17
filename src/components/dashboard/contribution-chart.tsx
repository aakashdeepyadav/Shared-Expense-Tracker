"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { Contribution, User, Expense } from "@/lib/types";

type ContributionChartProps = {
  contributions: Contribution[];
  users: User[];
  expenses: Expense[];
};

const chartColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function ContributionChart({
  contributions,
  users,
  expenses,
}: ContributionChartProps) {
  const compactCurrency = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  });

  const contributionData = users
    .map((user, index) => {
      const walletContributions = contributions
        .filter((c) => c.contributorId === user.id)
        .reduce((acc, c) => acc + c.amount, 0);

      const expensesPaid = expenses
        .filter((e) => e.payerId === user.id)
        .reduce((acc, e) => acc + e.amount, 0);

      const total = walletContributions + expensesPaid;

      return {
        name: user.name.split(" ")[0], // Use first name for chart label
        total: total,
        fill: chartColors[index % chartColors.length],
      };
    })
    .filter((d) => d.total > 0);

  const chartConfig: ChartConfig = {
    total: {
      label: "Total",
    },
  };

  contributionData.forEach((data) => {
    chartConfig[data.name as keyof typeof chartConfig] = {
      label: data.name,
      color: data.fill,
    };
  });

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto min-h-[210px] w-full min-w-0 max-w-[25rem] overflow-hidden sm:min-h-[220px] md:max-w-none"
    >
      <BarChart
        accessibilityLayer
        data={contributionData}
        margin={{ top: 12, right: 4, bottom: 8, left: 0 }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 4" opacity={0.35} />
        <XAxis
          dataKey="name"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          interval={0}
          tickFormatter={(value) => String(value).slice(0, 8)}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(value) => `₹${compactCurrency.format(Number(value))}`}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          width={52}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => `₹${Number(value).toFixed(2)}`}
              hideLabel
            />
          }
        />
        <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={42}>
          {contributionData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
