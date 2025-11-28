
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { Contribution, User, Expense } from "@/lib/types";

type ContributionChartProps = {
  contributions: Contribution[];
  users: User[];
  expenses: Expense[];
}

const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export function ContributionChart({ contributions, users, expenses }: ContributionChartProps) {

  const contributionData = users.map((user, index) => {
    const walletContributions = contributions
      .filter(c => c.contributorId === user.id)
      .reduce((acc, c) => acc + c.amount, 0);

    const expensesPaid = expenses
      .filter(e => e.payerId === user.id)
      .reduce((acc, e) => acc + e.amount, 0);

    const total = walletContributions + expensesPaid;
      
    return {
      name: user.name.split(' ')[0], // Use first name for chart label
      total: total,
      fill: chartColors[index % chartColors.length],
    }
  }).filter(d => d.total > 0);

  const chartConfig = {
    total: {
      label: "Total",
    },
  } satisfies ChartConfig

  contributionData.forEach(data => {
    chartConfig[data.name as keyof typeof chartConfig] = {
        label: data.name,
        color: data.fill,
    }
  });

  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart 
        accessibilityLayer 
        data={contributionData} 
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => `₹${value}`}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent
            formatter={(value) => `₹${Number(value).toFixed(2)}`}
            hideLabel
          />}
        />
        <Bar dataKey="total" radius={4}>
          {contributionData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
