"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
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
  { href: "/settings", icon: Settings, label: "Settings" },
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
        (msg) => !msg.readBy.includes(currentUser.id),
      );
      setHasUnreadMessages(anyUnread);
    });

    return () => unsub();
  }, [currentUser]);

  if (
    !isMobile ||
    !currentUser ||
    pathname === "/login" ||
    pathname === "/setup"
  ) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden animate-soft-pop px-2 pb-2 pt-2"
      style={{
        paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
        paddingLeft: "calc(0.5rem + env(safe-area-inset-left))",
        paddingRight: "calc(0.5rem + env(safe-area-inset-right))",
      }}
    >
      <nav className="modern-surface flex items-center justify-around h-16 rounded-2xl border border-white/45 bg-white/88 px-1 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-900/82">
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
              aria-label={item.label}
              className={cn(
                "relative flex flex-col items-center justify-center text-[11px] w-full h-full gap-1 rounded-xl transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary font-semibold -translate-y-0.5"
                  : "text-muted-foreground hover:text-primary",
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5",
                  isActive &&
                    "scale-110 drop-shadow-[0_2px_6px_hsl(var(--primary)/0.35)]",
                )}
              />
              <span>{item.label}</span>
              {isChat && hasUnreadMessages && pathname !== "/chat" && (
                <span className="absolute top-3 right-1/2 translate-x-[20px] h-2 w-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
