"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ShieldCheck, Users, ArrowLeft, ArrowRight } from "lucide-react";

export default function GuidePage() {
  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-50 p-4 dark:bg-slate-950 md:p-8">
      <div className="mx-auto w-full max-w-5xl animate-fade-up space-y-6">
        <header className="rounded-2xl border border-border/70 bg-background/90 p-5 md:p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                User Guide
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Clear instructions for Admin and Member usage.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Login Help</Badge>
            <Badge variant="secondary">Admin Flow</Badge>
            <Badge variant="secondary">Member Flow</Badge>
            <Badge variant="secondary">Monthly Rollover</Badge>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="modern-surface border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Admin Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">1. Login</p>
              <p className="text-muted-foreground">Use your admin name and admin password.</p>
              <p className="font-medium">2. Daily Operations</p>
              <p className="text-muted-foreground">Add expenses and contributions from dashboard actions.</p>
              <p className="font-medium">3. Settings</p>
              <p className="text-muted-foreground">Update admin password, shared member PIN, and member phone details.</p>
              <p className="font-medium">4. Reports</p>
              <p className="text-muted-foreground">Generate reports to see spending, balances, who owes, and settlement suggestions.</p>
              <p className="font-medium">5. Start New Month</p>
              <p className="text-muted-foreground">Use admin password to archive current month and reset live records.</p>
            </CardContent>
          </Card>

          <Card className="modern-surface border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Member Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">1. Login</p>
              <p className="text-muted-foreground">Select group, then enter your name and shared member PIN.</p>
              <p className="font-medium">2. Dashboard</p>
              <p className="text-muted-foreground">View your contribution, expense share, and latest activity.</p>
              <p className="font-medium">3. History</p>
              <p className="text-muted-foreground">Check expense and contribution history for current and archived months.</p>
              <p className="font-medium">4. Chat</p>
              <p className="text-muted-foreground">Send group updates and review unread messages.</p>
              <p className="font-medium">5. Profile</p>
              <p className="text-muted-foreground">Update your own display name and phone number in Settings.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="modern-surface border-0">
          <CardHeader>
            <CardTitle>Quick Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>- Group ID must be entered before login if no active group is selected.</p>
            <p>- If login fails repeatedly, wait for lockout timer to finish and try again.</p>
            <p>- If Start New Month fails, ensure latest Firestore rules are deployed.</p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button variant="outline" asChild className="h-11">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Login
            </Link>
          </Button>
          <Button asChild className="h-11">
            <Link href="/setup">
              Create New Group
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
