"use client";

import { cn } from "@acme/ui";
import { Button } from "@acme/ui/button";
import { ThemeToggle } from "@acme/ui/theme";
import {
  Bell,
  BookOpenText,
  FileText,
  LayoutDashboard,
  PenLine,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AuthStatus } from "~/auth/status";
import { siteConfig } from "~/config/site";

const navigation = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/posts/", icon: FileText, label: "Content" },
  { href: "/editor/", icon: PenLine, label: "Editor" },
  { href: "/users/", icon: Users, label: "Users" },
  { href: "/admin/", icon: ShieldCheck, label: "Admin" },
] as const;

function Sidebar(props: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <Link
        className="flex h-16 items-center gap-3 border-b px-5"
        href="/"
        onClick={props.onNavigate}
      >
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <BookOpenText aria-hidden="true" className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">{siteConfig.name}</p>
          <p className="text-muted-foreground text-xs">Application workspace</p>
        </div>
      </Link>

      <nav aria-label="Primary" className="flex-1 space-y-1 px-3 py-5">
        <p className="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase">
          Workspace
        </p>
        {navigation.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href.replace(/\/$/, ""));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={props.onNavigate}
              className={cn(
                "text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium",
                active && "bg-muted text-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/admin/"
          onClick={props.onNavigate}
          className="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2"
        >
          <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-full text-xs font-semibold">
            {siteConfig.user.initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {siteConfig.user.name}
            </span>
            <span className="text-muted-foreground block truncate text-xs">
              {siteConfig.user.role}
            </span>
          </span>
          <Settings
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
        </Link>
      </div>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname.startsWith(href.replace(/\/$/, ""));
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/auth/")) return props.children;

  return (
    <div className="bg-muted/30 min-h-screen">
      <aside className="bg-background fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <Sidebar />
      </aside>

      <div className="lg:pl-64">
        <header className="bg-background/90 sticky top-0 z-20 flex h-16 items-center border-b px-4 backdrop-blur-xl sm:px-6">
          <Link className="flex items-center gap-2 lg:hidden" href="/">
            <span className="bg-foreground text-background flex size-8 items-center justify-center rounded-md">
              <BookOpenText aria-hidden="true" className="size-4" />
            </span>
            <span className="text-sm font-semibold">{siteConfig.name}</span>
          </Link>

          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hidden h-9 min-w-64 items-center gap-2 rounded-md border px-3 text-left text-sm md:flex"
          >
            <Search aria-hidden="true" className="size-4" />
            Search workspace
            <span className="ml-auto text-xs">Ctrl K</span>
          </button>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Button
              aria-label="Search"
              className="md:hidden"
              size="icon"
              variant="ghost"
            >
              <Search />
            </Button>
            <span className="hidden sm:block">
              <ThemeToggle />
            </span>
            <Button aria-label="Notifications" size="icon" variant="ghost">
              <Bell aria-hidden="true" />
            </Button>
            <span className="mx-2 hidden h-6 w-px bg-border sm:block" />
            <AuthStatus compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pt-5 pb-28 sm:px-6 sm:pt-7 lg:px-8 lg:py-8">
          {props.children}
        </main>
      </div>

      <nav
        aria-label="Mobile navigation"
        className="bg-background/95 fixed inset-x-0 bottom-0 z-40 grid h-20 grid-cols-5 border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted-foreground relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active && "text-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-md",
                  active && "bg-primary/10 text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
