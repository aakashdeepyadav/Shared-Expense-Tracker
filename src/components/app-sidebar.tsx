"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ReceiptText,
  PiggyBank,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/icons/logo";
import { useAuth } from "@/context/auth-context";
import { Button } from "./ui/button";
import { subscribeToMessages } from "@/lib/firestore";
import type { ChatMessage } from "@/lib/types";

export function AppSidebar() {
  const pathname = usePathname();
  const { currentUser, logout, isAdmin, appConfig } = useAuth();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const unsub = subscribeToMessages((messages: ChatMessage[]) => {
      const anyUnread = messages.some(
        (msg) => !msg.readBy.includes(currentUser.id),
      );
      setHasUnreadMessages(anyUnread);
    });

    return () => unsub();
  }, [currentUser]);

  if (!currentUser || pathname === "/login" || pathname === "/setup") {
    return null;
  }

  const appLabel = appConfig?.groupName || "Shared Expense";

  return (
    <Sidebar variant="floating" className="p-2 md:p-3">
      <SidebarHeader className="p-4 rounded-2xl border border-white/10 bg-sidebar/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
          <h1 className="font-headline text-lg font-bold truncate">
            {appLabel}
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-3 md:p-4">
        <SidebarMenu className="space-y-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/"}
              tooltip="Dashboard"
              className="rounded-xl h-10"
            >
              <Link href="/">
                <LayoutDashboard />
                Dashboard
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/expense-history"}
              tooltip="Expense History"
              className="rounded-xl h-10"
            >
              <Link href="/expense-history">
                <ReceiptText />
                Expense History
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/contribution-history"}
              tooltip="Contribution History"
              className="rounded-xl h-10"
            >
              <Link href="/contribution-history">
                <PiggyBank />
                Contribution History
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/chat"}
              tooltip="Chat"
              className="rounded-xl h-10"
            >
              <Link href="/chat" className="relative">
                <MessageSquare />
                Chat
                {hasUnreadMessages && pathname !== "/chat" && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/reports"}
                tooltip="Reports"
                className="rounded-xl h-10"
              >
                <Link href="/reports">
                  <FileText />
                  Reports
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/control-admin"}
                tooltip="Control Admin"
                className="rounded-xl h-10"
              >
                <Link href="/control-admin">
                  <ShieldCheck />
                  Control Admin
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname === "/audit-logs"}
                tooltip="Audit Logs"
                className="rounded-xl h-10"
              >
                <Link href="/audit-logs">
                  <ClipboardList />
                  Audit Logs
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
              className="rounded-xl h-10"
            >
              <Link href="/settings">
                <Settings />
                Settings
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="m-2 rounded-2xl border border-white/10 bg-sidebar/75 p-4 flex items-center justify-between backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              data-ai-hint="person portrait"
            />
            <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <p className="font-semibold truncate">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isAdmin ? "Admin" : "Member"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="h-8 w-8"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
