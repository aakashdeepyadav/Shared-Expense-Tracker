"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import {
  subscribeToMessages,
  addMessage,
  markMessagesAsRead,
} from "@/lib/firestore";
import type { ChatMessage } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ChatShimmer } from "@/components/shimmers/chat-shimmer";

export default function ChatPage() {
  const { currentUser, isAuthLoading, isAppConfigured } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthLoading && !isAppConfigured) {
      router.push("/setup");
    } else if (!isAuthLoading && !currentUser) {
      router.push("/login");
    } else if (currentUser) {
      setIsDataLoading(true);
      const unsubMessages = subscribeToMessages((msgs) => {
        setMessages(msgs);
        setIsDataLoading(false);
      });
      return () => unsubMessages();
    }
  }, [currentUser, isAppConfigured, isAuthLoading, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentUser && messages.length > 0) {
      const unreadMessageIds = messages
        .filter((msg) => !msg.readBy.includes(currentUser.id))
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        markMessagesAsRead(unreadMessageIds, currentUser.id);
      }
    }
  }, [messages, currentUser]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === "" || !currentUser) return;

    setIsSending(true);
    const messageData = {
      text: newMessage,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatarUrl,
    };

    try {
      await addMessage(messageData);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      // Optionally, show a toast notification for the error
    } finally {
      setIsSending(false);
    }
  };

  if (isAuthLoading || (!currentUser && !isDataLoading)) {
    return <ChatShimmer />;
  }

  if (!currentUser) {
    return <ChatShimmer />;
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader />
      <main className="flex-1 flex flex-col p-3 md:p-6 pb-20 md:pb-6">
        <div className="modern-surface animate-fade-up flex-1 flex flex-col w-full mx-auto border-0 p-3 md:p-5">
          <div className="flex-1 overflow-y-auto space-y-4 md:space-y-6 pr-1 md:pr-2">
            {messages.map((msg) => {
              const isOwnMessage = msg.userId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex items-start gap-3",
                    isOwnMessage && "justify-end",
                  )}
                >
                  {!isOwnMessage && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={msg.userAvatar} alt={msg.userName} />
                      <AvatarFallback>{msg.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] md:max-w-[70%] px-3 py-2.5 md:p-3 rounded-2xl flex flex-col shadow-sm",
                      isOwnMessage
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted/80 rounded-bl-none",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {!isOwnMessage && (
                        <span className="font-bold text-sm">
                          {msg.userName}
                        </span>
                      )}
                      <span className="text-xs opacity-70">
                        {msg.timestamp
                          ? format(new Date(msg.timestamp), "p")
                          : ""}
                      </span>
                    </div>
                    <p className="text-[13px] md:text-sm break-words leading-relaxed">
                      {msg.text}
                    </p>
                  </div>
                  {isOwnMessage && (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={msg.userAvatar} alt={msg.userName} />
                      <AvatarFallback>{msg.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
            {messages.length === 0 && !isDataLoading && (
              <div className="text-center text-muted-foreground pt-16">
                No messages yet. Start the conversation!
              </div>
            )}
          </div>
          <div className="pt-3 md:pt-4 bg-transparent">
            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-2 backdrop-blur"
            >
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                autoComplete="off"
                disabled={isSending}
                className="border-0 bg-transparent focus-visible:ring-0"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isSending || newMessage.trim() === ""}
                className="h-9 w-9 rounded-lg"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
