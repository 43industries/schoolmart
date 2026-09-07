"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { LogOut, Menu } from "lucide-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
}

interface PortalLayoutProps {
  title: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

export function PortalLayout({ title, navItems, children }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-brand-surface">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-100 bg-white transition-transform lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex h-16 items-center px-5">
          <Logo size="sm" />
        </div>
        <div className="px-5 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">{title}</p>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "block rounded-full px-4 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-brand-teal text-white shadow-sm"
                    : "text-brand-muted hover:bg-brand-teal/5 hover:text-brand-teal",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white p-4">
          {user && (
            <div className="mb-3 px-1">
              <p className="text-sm font-medium text-brand-ink">{user.firstName} {user.lastName}</p>
              <p className="truncate text-xs text-brand-muted">{user.email ?? user.phone}</p>
            </div>
          )}
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm text-brand-muted transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b border-gray-100 bg-white px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5 text-brand-teal" />
          </button>
          <h1 className="text-lg font-semibold text-brand-ink">{title}</h1>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
