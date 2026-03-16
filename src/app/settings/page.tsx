"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import {
  addAdminAuditLog,
  getAdminPassword,
  rolloverMonthWithArchive,
  updateUserPhoneNumber,
} from "@/lib/firestore";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SettingsShimmer } from "@/components/shimmers/settings-shimmer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/lib/types";
import { PageHeader } from "@/components/page-header";

export default function SettingsPage() {
  const {
    currentUser,
    isAdmin,
    updateUserCredential,
    logout,
    isAuthLoading,
    isAppConfigured,
    users,
    isDataLoading,
  } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [newCredential, setNewCredential] = useState("");
  const [confirmCredential, setConfirmCredential] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStartingNewMonth, setIsStartingNewMonth] = useState(false);
  const [monthResetPassword, setMonthResetPassword] = useState("");

  // State for admin phone number change
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  const getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : "An unknown error occurred.";

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router]);

  if (isAuthLoading || !currentUser) {
    return <SettingsShimmer />;
  }

  const credentialType = isAdmin ? "Password" : "PIN";
  const credentialLength = isAdmin ? undefined : 6;
  const minCredentialLength = isAdmin ? 8 : 6;
  const credentialHint = isAdmin ? "at least 8 characters" : "exactly 6 digits";
  const inputType = isAdmin ? "password" : "text";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    if (newCredential.length !== minCredentialLength && !isAdmin) {
      toast({
        variant: "destructive",
        title: `Invalid ${credentialType}`,
        description: `${credentialType} must be ${credentialHint}.`,
      });
      setIsUpdating(false);
      return;
    }

    if (newCredential.length < minCredentialLength && isAdmin) {
      toast({
        variant: "destructive",
        title: `Invalid ${credentialType}`,
        description: `${credentialType} must be ${credentialHint}.`,
      });
      setIsUpdating(false);
      return;
    }

    if (newCredential !== confirmCredential) {
      toast({
        variant: "destructive",
        title: `${credentialType}s do not match.`,
      });
      setIsUpdating(false);
      return;
    }

    const success = await updateUserCredential(newCredential);

    if (success) {
      toast({
        title: `${credentialType} Updated`,
        description: `Your ${credentialType} has been successfully updated.`,
      });
      setNewCredential("");
      setConfirmCredential("");

      // Log out user after credential change for security
      setTimeout(() => {
        toast({
          title: `Security Update`,
          description: "Please log in again with your new credentials.",
        });
        logout();
      }, 1000);
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: `Could not update your ${credentialType}. Please try again.`,
      });
    }
    setIsUpdating(false);
  };

  const handleUpdatePhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !newPhoneNumber) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please select a user and enter a new phone number.",
      });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(newPhoneNumber)) {
      toast({
        variant: "destructive",
        title: "Invalid Phone Number",
        description: "Please enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    setIsUpdatingPhone(true);
    const fullPhoneNumber = `+91${newPhoneNumber}`;

    try {
      await updateUserPhoneNumber(selectedUserId, fullPhoneNumber);
      await addAdminAuditLog({
        action: "member.phone.update",
        metadata: { userId: selectedUserId, phoneNumber: fullPhoneNumber },
      });
      const userName =
        users.find((u) => u.id === selectedUserId)?.name || "User";
      toast({
        title: "Phone Number Updated",
        description: `${userName}'s phone number has been successfully changed.`,
      });
      setSelectedUserId("");
      setNewPhoneNumber("");
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: getErrorMessage(error),
      });
    }
    setIsUpdatingPhone(false);
  };

  const handleStartNewMonth = async () => {
    if (!monthResetPassword.trim()) {
      toast({
        variant: "destructive",
        title: "Password required",
        description: "Please enter admin password to confirm month reset.",
      });
      return;
    }

    setIsStartingNewMonth(true);
    try {
      const currentPassword = await getAdminPassword();
      if (!currentPassword || currentPassword !== monthResetPassword) {
        throw new Error("Invalid admin password.");
      }

      const rollover = await rolloverMonthWithArchive();
      await addAdminAuditLog({
        action: "month.rollover.start",
        metadata: {
          archiveId: rollover.id,
          periodLabel: rollover.periodLabel,
          expenseCount: rollover.expenseCount,
          contributionCount: rollover.contributionCount,
          messageCount: rollover.messageCount,
        },
      });

      toast({
        title: "New Month Started!",
        description: `New month started. Archived ${rollover.periodLabel} data for history.`,
      });
      setMonthResetPassword("");
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to Start New Month",
        description:
          getErrorMessage(error) ||
          "An unexpected error occurred. Please check the setup instructions in README.md.",
      });
    } finally {
      setIsStartingNewMonth(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <PageHeader />
      <main className="relative flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6 lg:p-8">
        <div className="mx-auto w-full max-w-5xl space-y-6 md:space-y-8">
          <div className="pointer-events-none absolute -left-14 top-6 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
          <div className="pointer-events-none absolute right-0 top-32 h-64 w-64 rounded-full bg-amber-300/20 blur-3xl dark:bg-amber-500/10" />

          <header className="mb-4 animate-fade-up">
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Settings
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your account and app data.
            </p>
          </header>

          <Card className="modern-surface max-w-2xl mx-auto border-0 animate-soft-pop">
            <CardHeader>
              <CardTitle>Update Your Credentials</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Update your admin password. It must be at least 8 characters long."
                  : "Update your 6-digit member PIN."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="new-credential">New {credentialType}</Label>
                  <Input
                    id="new-credential"
                    type={inputType}
                    value={newCredential}
                    onChange={(e) =>
                      setNewCredential(
                        isAdmin
                          ? e.target.value
                          : e.target.value.replace(/\D/g, ""),
                      )
                    }
                    maxLength={credentialLength}
                    placeholder={`Enter new ${credentialType}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-credential">
                    Confirm New {credentialType}
                  </Label>
                  <Input
                    id="confirm-credential"
                    type={inputType}
                    value={confirmCredential}
                    onChange={(e) =>
                      setConfirmCredential(
                        isAdmin
                          ? e.target.value
                          : e.target.value.replace(/\D/g, ""),
                      )
                    }
                    maxLength={credentialLength}
                    placeholder={`Confirm new ${credentialType}`}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    `Update ${credentialType}`
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {isAdmin && (
            <>
              <Card className="modern-surface max-w-2xl mx-auto border-0 animate-soft-pop">
                <CardHeader>
                  <CardTitle>Update Member Phone Number</CardTitle>
                  <CardDescription>
                    Change the registered mobile number for a member OTP
                    authentication.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleUpdatePhoneNumber}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="user-select-phone">Member</Label>
                      <Select
                        onValueChange={setSelectedUserId}
                        value={selectedUserId}
                        disabled={isDataLoading}
                      >
                        <SelectTrigger id="user-select-phone">
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user: User) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.phoneNumber || "No number"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-phone-number">New Phone Number</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          +91
                        </span>
                        <Input
                          id="new-phone-number"
                          type="tel"
                          value={newPhoneNumber}
                          onChange={(e) =>
                            setNewPhoneNumber(e.target.value.replace(/\D/g, ""))
                          }
                          placeholder="98765 43210"
                          maxLength={10}
                          className="pl-10"
                          disabled={isUpdatingPhone}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isUpdatingPhone || isDataLoading}
                    >
                      {isUpdatingPhone ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        `Update Phone Number`
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="max-w-2xl mx-auto border border-destructive/60 bg-destructive/10 dark:bg-destructive/15 rounded-2xl shadow-md animate-soft-pop">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-6 w-6 text-destructive" />
                    <CardTitle>Admin Zone - Danger</CardTitle>
                  </div>
                  <CardDescription>
                    This action archives the current month into Firestore
                    history, then starts a fresh live month. Existing history
                    stays accessible in history pages.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={isStartingNewMonth}
                      >
                        {isStartingNewMonth ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Start New Month"
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will archive current expenses, contributions, and
                          chat data into a monthly history record, then clear
                          the live month. Enter admin password to continue.
                        </AlertDialogDescription>
                        <div className="space-y-2">
                          <Label htmlFor="month-reset-password">
                            Confirm admin password
                          </Label>
                          <Input
                            id="month-reset-password"
                            type="password"
                            value={monthResetPassword}
                            onChange={(e) =>
                              setMonthResetPassword(e.target.value)
                            }
                            placeholder="Enter admin password"
                            disabled={isStartingNewMonth}
                          />
                        </div>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleStartNewMonth}
                          disabled={
                            isStartingNewMonth || !monthResetPassword.trim()
                          }
                        >
                          Yes, start new month
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardFooter>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
