
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  Settings,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import React, { useState, useEffect } from "react";
import { subscribeToMessages } from "@/lib/firestore";
import type { ChatMessage } from "@/lib/types";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/expense-history", icon: ReceiptText, label: "Expenses" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/settings", icon: Settings, label: "Settings" }
];


export function AppBottomNav() {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
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

  if (!isMobile || !currentUser || pathname === "/login") {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm md:hidden">
      <nav className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const isChat = item.href === "/chat";
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center justify-center text-xs w-full h-full gap-1 transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {isChat && hasUnreadMessages && pathname !== '/chat' && (
                <span className="absolute top-3 right-1/2 translate-x-[20px] h-2 w-2 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
