
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Settings, ReceiptText, PiggyBank, MessageSquare } from "lucide-react";
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
  const { currentUser, logout, isAdmin } = useAuth();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const unsub = subscribeToMessages((messages: ChatMessage[]) => {
      const anyUnread = messages.some(
        msg => !msg.readBy.includes(currentUser.id)
      );
      setHasUnreadMessages(anyUnread);
    });

    return () => unsub();
  }, [currentUser]);

  if (!currentUser || pathname === '/login') {
    return null;
  }

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8" />
          <h1 className="font-headline text-lg font-bold">
            TiFresh
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/"}
              tooltip="Dashboard"
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
            >
              <Link href="/chat" className="relative">
                <MessageSquare />
                Chat
                {hasUnreadMessages && pathname !== '/chat' && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500" />
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/reports"}
              tooltip="Reports"
            >
              <Link href="/reports">
                <FileText />
                Reports
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Settings"
            >
              <Link href="/settings">
                <Settings />
                Settings
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t flex items-center justify-between">
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
        <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
          <LogOut className="h-4 w-4" />
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
