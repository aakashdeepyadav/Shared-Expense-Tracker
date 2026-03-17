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
  rolloverMonthWithArchive,
  updateSharedMemberPin,
  updateUserProfile,
  updateUserPhoneNumber,
  verifyAdminPassword,
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
  const [newSharedPin, setNewSharedPin] = useState("");
  const [confirmSharedPin, setConfirmSharedPin] = useState("");
  const [isUpdatingSharedPin, setIsUpdatingSharedPin] = useState(false);
  const [isStartingNewMonth, setIsStartingNewMonth] = useState(false);
  const [monthResetPassword, setMonthResetPassword] = useState("");
  const [profileName, setProfileName] = useState(currentUser.name || "");
  const [profilePhone, setProfilePhone] = useState(
    (currentUser.phoneNumber || "").replace(/^\+91/, ""),
  );
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

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

  useEffect(() => {
    setProfileName(currentUser.name || "");
    setProfilePhone((currentUser.phoneNumber || "").replace(/^\+91/, ""));
  }, [currentUser.name, currentUser.phoneNumber]);

  if (isAuthLoading || !currentUser) {
    return <SettingsShimmer />;
  }

  const credentialType = "Password";
  const minCredentialLength = 8;
  const credentialHint = "at least 8 characters";
  const dotPatternLight = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%2394a3b8'/%3E%3C/svg%3E\")",
  };
  const dotPatternDark = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Ccircle cx='2' cy='2' r='1' fill='%23475569'/%3E%3C/svg%3E\")",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    if (newCredential.length < minCredentialLength) {
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
    } else {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: `Could not update your ${credentialType}. Please try again.`,
      });
    }
    setIsUpdating(false);
  };

  const handleUpdateSharedPin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(newSharedPin)) {
      toast({
        variant: "destructive",
        title: "Invalid PIN",
        description: "Shared member PIN must be exactly 6 digits.",
      });
      return;
    }

    if (newSharedPin !== confirmSharedPin) {
      toast({
        variant: "destructive",
        title: "PINs do not match",
      });
      return;
    }

    setIsUpdatingSharedPin(true);
    try {
      await updateSharedMemberPin(newSharedPin);
      await addAdminAuditLog({
        action: "member.pin.update",
        metadata: { scope: "all-members" },
      });
      toast({
        title: "Shared PIN updated",
        description: "All member PINs were updated successfully.",
      });
      setNewSharedPin("");
      setConfirmSharedPin("");
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: getErrorMessage(error),
      });
    } finally {
      setIsUpdatingSharedPin(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = profileName.trim();
    if (!trimmedName) {
      toast({
        variant: "destructive",
        title: "Invalid name",
        description: "Name is required.",
      });
      return;
    }

    if (profilePhone && !/^[6-9]\d{9}$/.test(profilePhone)) {
      toast({
        variant: "destructive",
        title: "Invalid phone number",
        description: "Enter a valid 10-digit Indian mobile number.",
      });
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateUserProfile(currentUser.id, {
        name: trimmedName,
        phoneNumber: profilePhone ? `+91${profilePhone}` : undefined,
      });
      toast({
        title: "Profile updated",
        description: "Your profile details were saved.",
      });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: getErrorMessage(error),
      });
    } finally {
      setIsUpdatingProfile(false);
    }
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
      const isValidAdminPassword =
        await verifyAdminPassword(monthResetPassword);
      if (!isValidAdminPassword) {
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
    <div className="flex h-full flex-col">
      <PageHeader />
      <main className="relative flex-1 overflow-y-auto bg-slate-50 p-4 pb-20 dark:bg-slate-950 md:p-6 md:pb-6 lg:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-35 dark:hidden"
          style={dotPatternLight}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden opacity-30 dark:block"
          style={dotPatternDark}
        />
        <div className="mx-auto w-full space-y-6 md:space-y-8">
          <div className="pointer-events-none absolute left-10 top-8 h-16 w-16 rounded-2xl border border-cyan-200 bg-cyan-100/70 dark:border-cyan-900 dark:bg-cyan-950/40" />
          <div className="pointer-events-none absolute right-8 top-24 h-20 w-20 rounded-xl border border-amber-200 bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40" />

          <header className="mb-4 animate-fade-up">
            <h1 className="text-2xl font-bold tracking-tight font-headline md:text-3xl lg:text-4xl">
              Settings
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Manage your account and app data.
            </p>
          </header>

          {isAdmin ? (
            <>
              <Card className="modern-surface w-full border-0 animate-soft-pop">
                <CardHeader>
                  <CardTitle>Update Admin Password</CardTitle>
                  <CardDescription>
                    Update your admin password. It must be at least 8 characters
                    long.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="new-credential">
                        New {credentialType}
                      </Label>
                      <Input
                        id="new-credential"
                        type="password"
                        value={newCredential}
                        onChange={(e) => setNewCredential(e.target.value)}
                        placeholder={`Enter new ${credentialType}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-credential">
                        Confirm New {credentialType}
                      </Label>
                      <Input
                        id="confirm-credential"
                        type="password"
                        value={confirmCredential}
                        onChange={(e) => setConfirmCredential(e.target.value)}
                        placeholder={`Confirm new ${credentialType}`}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isUpdating}
                    >
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

              <Card className="modern-surface w-full border-0 animate-soft-pop">
                <CardHeader>
                  <CardTitle>Update Shared Member PIN</CardTitle>
                  <CardDescription>
                    Set one 6-digit PIN for all non-admin members.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateSharedPin} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="new-shared-pin">New shared PIN</Label>
                      <Input
                        id="new-shared-pin"
                        type="password"
                        value={newSharedPin}
                        maxLength={6}
                        onChange={(e) =>
                          setNewSharedPin(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Enter 6-digit PIN"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-shared-pin">
                        Confirm shared PIN
                      </Label>
                      <Input
                        id="confirm-shared-pin"
                        type="password"
                        value={confirmSharedPin}
                        maxLength={6}
                        onChange={(e) =>
                          setConfirmSharedPin(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="Confirm 6-digit PIN"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isUpdatingSharedPin}
                    >
                      {isUpdatingSharedPin ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Shared PIN"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="modern-surface w-full border-0 animate-soft-pop">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>
                  Update your name and phone number.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Name</Label>
                    <Input
                      id="profile-name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Phone Number</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        +91
                      </span>
                      <Input
                        id="profile-phone"
                        type="tel"
                        value={profilePhone}
                        onChange={(e) =>
                          setProfilePhone(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="9876543210"
                        maxLength={10}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isUpdatingProfile}
                  >
                    {isUpdatingProfile ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Profile"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {isAdmin && (
            <>
              <Card className="modern-surface w-full border-0 animate-soft-pop">
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

              <Card className="w-full border border-destructive/60 bg-destructive/10 dark:bg-destructive/15 rounded-2xl shadow-md animate-soft-pop">
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
