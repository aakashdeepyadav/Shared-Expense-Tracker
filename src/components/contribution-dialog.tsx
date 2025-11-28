
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

type ContributionDialogProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddContribution: (contribution: { contributorId: string; amount: number }) => void;
  users: User[];
};

export function ContributionDialog({
  children,
  open,
  onOpenChange,
  onAddContribution,
  users,
}: ContributionDialogProps) {
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const contributorId = formData.get("contributorId") as string;
    
    if (amount > 0 && contributorId) {
        onAddContribution({ contributorId, amount });
        const contributorName = users.find(u => u.id === contributorId)?.name || 'Someone';
        toast({
            title: "Contribution Added",
            description: `${contributorName} added ${formatCurrency(amount)} to the wallet.`,
        });
        onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Contribution</DialogTitle>
            <DialogDescription>
              Record a new contribution to the shared wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contributor">Contributor</Label>
              <Select name="contributorId" defaultValue={users.length > 0 ? users[0].id : ''}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contributor" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground">₹</span>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Contribution</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
