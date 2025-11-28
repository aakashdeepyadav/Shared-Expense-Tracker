
"use client";

import type { Metadata } from "next";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { Inter } from 'next/font/google'
import { AppBottomNav } from "@/components/app-bottom-nav";
import { LoginShimmer } from "@/components/shimmers/login-shimmer";
import React from "react";
import FirebaseErrorListener from "@/components/FirebaseErrorListener";

// This is outside because metadata can't be in a client component
// export const metadata: Metadata = {
//   title: "TiFresh",
//   description: "Your friendly expense splitting assistant.",
// };

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthLoading } = useAuth();
  
  // Set metadata dynamically
  if (typeof window !== "undefined") {
    document.title = "TiFresh - Your friendly expense splitting assistant.";
  }

  if (isAuthLoading) {
    return <LoginShimmer />;
  }
  
  return (
    <>
      <OfflineBanner />
      <SidebarProvider>
        <div className="flex">
          <AppSidebar />
          <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
        </div>
        <AppBottomNav />
      </SidebarProvider>
      <Toaster />
      <FirebaseErrorListener />
    </>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-body antialiased"
        )}
      >
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
           <AppLayout>{children}</AppLayout>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

    