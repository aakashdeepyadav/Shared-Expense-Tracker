
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert } from "lucide-react";
import { startNewMonthAction, updateUserPhoneNumberAction } from "@/app/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@/lib/types";

export default function SettingsPage() {
  const { currentUser, isAdmin, updateUserCredential, logout, isAuthLoading, users, isDataLoading, getToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [newCredential, setNewCredential] = useState("");
  const [confirmCredential, setConfirmCredential] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isStartingNewMonth, setIsStartingNewMonth] = useState(false);

  // State for admin phone number change
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, isAuthLoading, router]);

  if (isAuthLoading || !currentUser) {
    return <SettingsShimmer />;
  }
  
  const credentialType = isAdmin ? 'Password' : 'PIN';
  const credentialLength = isAdmin ? undefined : 6;
  const minCredentialLength = isAdmin ? 8 : 6;
  const credentialHint = isAdmin ? 'at least 8 characters' : 'exactly 6 digits';
  const inputType = isAdmin ? 'password' : 'text';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    if (newCredential.length !== minCredentialLength && !isAdmin) {
       toast({ variant: "destructive", title: `Invalid ${credentialType}`, description: `${credentialType} must be ${credentialHint}.` });
       setIsUpdating(false);
       return;
    }

    if (newCredential.length < minCredentialLength && isAdmin) {
      toast({ variant: "destructive", title: `Invalid ${credentialType}`, description: `${credentialType} must be ${credentialHint}.` });
      setIsUpdating(false);
      return;
    }

    if (newCredential !== confirmCredential) {
      toast({ variant: "destructive", title: `${credentialType}s do not match.` });
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
      toast({ variant: "destructive", title: "Missing Information", description: "Please select a user and enter a new phone number." });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(newPhoneNumber)) {
        toast({ variant: "destructive", title: "Invalid Phone Number", description: "Please enter a valid 10-digit Indian mobile number." });
        return;
    }

    setIsUpdatingPhone(true);
    const token = await getToken();
    const fullPhoneNumber = `+91${newPhoneNumber}`;
    const result = await updateUserPhoneNumberAction(selectedUserId, fullPhoneNumber, token);
    
    if (result.success) {
      const userName = users.find(u => u.id === selectedUserId)?.name || "User";
      toast({
        title: "Phone Number Updated",
        description: `${userName}'s phone number has been successfully changed.`,
      });
      setSelectedUserId("");
      setNewPhoneNumber("");
    } else {
       toast({
        variant: "destructive",
        title: "Update Failed",
        description: result.error || "An unexpected error occurred.",
      });
    }
    setIsUpdatingPhone(false);
  }

  const handleStartNewMonth = async () => {
    setIsStartingNewMonth(true);
    try {
      const token = await getToken();
      const result = await startNewMonthAction(token);
      if (result.success) {
        toast({
          title: "New Month Started!",
          description: result.message,
        });
      } else {
        throw new Error(result.error || "An unknown error occurred.");
      }
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Failed to Start New Month",
        description: error.message || "An unexpected error occurred. Please check the setup instructions in README.md.",
      });
    } finally {
      setIsStartingNewMonth(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold font-headline">Settings</h1>
        <p className="text-muted-foreground">Manage your account and app data.</p>
      </header>

      <Card className="max-w-2xl mx-auto">
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
                onChange={(e) => setNewCredential(isAdmin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                maxLength={credentialLength}
                placeholder={`Enter new ${credentialType}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-credential">Confirm New {credentialType}</Label>
              <Input
                id="confirm-credential"
                type={inputType}
                value={confirmCredential}
                onChange={(e) => setConfirmCredential(isAdmin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                maxLength={credentialLength}
                placeholder={`Confirm new ${credentialType}`}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isUpdating}>
              {isUpdating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : `Update ${credentialType}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin && (
        <>
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Update Member Phone Number</CardTitle>
              <CardDescription>Change the registered mobile number for a member's OTP authentication.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePhoneNumber} className="space-y-4">
                 <div className="space-y-2">
                  <Label htmlFor="user-select-phone">Member</Label>
                  <Select onValueChange={setSelectedUserId} value={selectedUserId} disabled={isDataLoading}>
                    <SelectTrigger id="user-select-phone">
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user: User) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.phoneNumber || 'No number'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-phone-number">New Phone Number</Label>
                   <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">+91</span>
                      <Input
                        id="new-phone-number"
                        type="tel"
                        value={newPhoneNumber}
                        onChange={(e) => setNewPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="98765 43210"
                        maxLength={10}
                        className="pl-10"
                        disabled={isUpdatingPhone}
                      />
                    </div>
                </div>
                <Button type="submit" className="w-full" disabled={isUpdatingPhone || isDataLoading}>
                  {isUpdatingPhone ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : `Update Phone Number`}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="max-w-2xl mx-auto border-destructive">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-destructive" />
                <CardTitle>Admin Zone - Danger</CardTitle>
              </div>
              <CardDescription>
                This action will archive all current expenses, contributions, and chat history to Google Sheets, and then permanently delete them from the database to start a new month. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isStartingNewMonth}>
                    {isStartingNewMonth ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : 'Start New Month'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all current expense, contribution, and chat data after archiving it to Google Sheets. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleStartNewMonth}>Yes, start new month</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </>
      )}
    </div>
  );
}
