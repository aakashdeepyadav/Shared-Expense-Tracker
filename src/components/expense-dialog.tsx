"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import React, { useState } from "react";
import { Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { predefinedTags } from "@/lib/data";
import type { Expense, User } from "@/lib/types";

const expenseFormSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  payerId: z.string().min(1, "Payer is required."),
  date: z.date(),
  tags: z.array(z.string()).min(1, "At least one tag is required."),
  participants: z
    .array(z.string())
    .min(1, "At least one participant is required."),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

type ExpenseDialogProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddExpense: (
    expense: Omit<Expense, "id" | "participants" | "date"> & {
      participants: string[];
      date: Date;
    },
  ) => void | Promise<void>;
  users: User[];
};

const WALLET_PAYER_ID = "shared-expense-tracker-wallet";

export function ExpenseDialog({
  children,
  open,
  onOpenChange,
  onAddExpense,
  users,
}: ExpenseDialogProps) {
  const { toast } = useToast();
  const [customTag, setCustomTag] = useState("");

  const defaultValues = React.useMemo(
    () => ({
      amount: undefined as unknown as number,
      payerId: WALLET_PAYER_ID,
      date: new Date(),
      tags: [],
      participants: users.map((u) => u.id),
    }),
    [users],
  );

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues,
  });

  const selectedTags = form.watch("tags") || [];

  React.useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const toggleTag = (tag: string) => {
    const currentTags = form.getValues("tags");
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    form.setValue("tags", newTags, { shouldValidate: true });
  };

  const handleAddCustomTag = () => {
    const tagToAdd = customTag.trim().toLowerCase();
    if (tagToAdd && !selectedTags.includes(tagToAdd)) {
      form.setValue("tags", [...selectedTags, tagToAdd], {
        shouldValidate: true,
      });
      setCustomTag("");
    }
  };

  async function onSubmit(data: ExpenseFormValues) {
    const description = data.tags
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .join(" + ");

    const expenseData = {
      ...data,
      description,
    };

    try {
      await onAddExpense(expenseData);
      toast({
        title: "Expense Added!",
        description: `"${description}" for ${formatCurrency(
          data.amount,
        )} has been recorded.`,
      });
      onOpenChange(false);
      form.reset(defaultValues);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Could not add expense",
        description:
          error instanceof Error
            ? error.message
            : "Please check your permissions and try again.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>
            Select tags to describe the expense, set the amount, and choose
            participants. The description will be created automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tags */}
            <FormField
              control={form.control}
              name="tags"
              render={() => (
                <FormItem>
                  <FormLabel>Tags (select one or more)</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {predefinedTags.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        variant={
                          selectedTags.includes(tag) ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => toggleTag(tag)}
                        className="capitalize"
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Input
                      placeholder="Add a custom tag..."
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomTag();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCustomTag}
                      aria-label="Add custom tag"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount + Payer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-8"
                          {...field}
                          value={
                            field.value === undefined ||
                            Number.isNaN(field.value as number)
                              ? ""
                              : field.value
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paid by</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select who paid" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WALLET_PAYER_ID}>
                          Shared Expense Tracker (Wallet)
                        </SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Expense</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={
                        field.value ? format(field.value, "yyyy-MM-dd") : ""
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        field.onChange(new Date(`${value}T12:00:00`));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Participants */}
            <FormField
              control={form.control}
              name="participants"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel>Participants</FormLabel>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {users.map((user) => (
                      <FormField
                        key={user.id}
                        control={form.control}
                        name="participants"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([
                                        ...(field.value || []),
                                        user.id,
                                      ])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== user.id,
                                        ),
                                      );
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {user.name}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Save Expense</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
