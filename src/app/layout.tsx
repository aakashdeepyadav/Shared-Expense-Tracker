"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { OfflineBanner } from "@/components/offline-banner";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { Inter } from "next/font/google";
import { AppBottomNav } from "@/components/app-bottom-nav";
import React from "react";
import FirebaseErrorListener from "@/components/FirebaseErrorListener";
import { usePathname, useRouter } from "next/navigation";

// This is outside because metadata can't be in a client component
// export const metadata: Metadata = {
//   title: "Shared Expense Tracker",
//   description: "Your friendly expense splitting assistant.",
// };

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

function AppSignature() {
  return (
    <p className="py-3 text-center text-xs text-muted-foreground/80">
      Made with ❤ by Aakash.
    </p>
  );
}

function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthLoading, appConfig, isAppConfigured, currentUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = React.useState(false);
  const isAuthPage = pathname === "/login" || pathname === "/setup";

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isMounted || isAuthLoading) {
      return;
    }

    if (!isAppConfigured && !isAuthPage) {
      router.replace("/login");
      return;
    }

    if (
      isAppConfigured &&
      !currentUser &&
      pathname !== "/login" &&
      pathname !== "/setup"
    ) {
      router.replace("/login");
    }
  }, [
    isMounted,
    isAuthLoading,
    isAppConfigured,
    isAuthPage,
    pathname,
    currentUser,
    router,
  ]);

  // Set metadata dynamically
  if (typeof window !== "undefined") {
    const trackerName = appConfig?.groupName || "Shared Expense Tracker";
    document.title = `${trackerName} - Shared Expense Tracker`;
  }

  if (!isMounted) {
    return <main className="min-h-screen w-full" />;
  }

  if (isAuthLoading && !isAuthPage) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading app...</p>
      </main>
    );
  }

  if (
    !isAuthLoading &&
    ((!isAppConfigured && !isAuthPage) ||
      (isAppConfigured &&
        !currentUser &&
        pathname !== "/login" &&
        pathname !== "/setup"))
  ) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </main>
    );
  }

  if (isAuthPage) {
    return (
      <>
        <OfflineBanner />
        <main className="relative min-h-screen">{children}</main>
        <AppSignature />
        <Toaster />
        <FirebaseErrorListener />
      </>
    );
  }

  return (
    <>
      <OfflineBanner />
      <SidebarProvider className="flex-col">
        <div className="page-shell flex min-h-screen w-full">
          <AppSidebar />
          <main className="relative flex-1 min-w-0 pb-16 md:pb-0">
            <div className="w-full">{children}</div>
          </main>
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
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className={cn("min-h-screen bg-background font-body antialiased")}>
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
