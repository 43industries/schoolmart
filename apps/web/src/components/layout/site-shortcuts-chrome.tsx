"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/get-started", label: "Get started" },
  { href: "/for-parents", label: "For parents" },
  { href: "/vendors", label: "For vendors" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Log in" },
] as const;

const fabClass =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg";

export function SiteShortcutsChrome() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const onHome = pathname === "/";

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  // Close panel after client navigations
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3">
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Shortcuts"
          className="pointer-events-auto w-56 rounded-2xl border border-gray-100 bg-white p-3 shadow-xl shadow-brand-ink/10"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Shortcuts</p>
            <button
              type="button"
              aria-label="Close shortcuts"
              className="rounded-lg p-1 text-brand-muted hover:bg-brand-surface hover:text-brand-ink"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {SHORTCUTS.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-brand-teal/10 font-semibold text-brand-teal"
                      : "text-brand-ink hover:bg-brand-surface",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      <div className="pointer-events-auto flex flex-col gap-2">
        {!onHome ? (
          <Link
            href="/"
            className={cn(fabClass, "bg-brand-ink shadow-brand-ink/20 hover:bg-brand-ink/90")}
          >
            <Home className="h-4 w-4" aria-hidden />
            Home
          </Link>
        ) : null}
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={panelId}
          className={cn(fabClass, "bg-brand-teal shadow-brand-teal/25 hover:opacity-95")}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          Shortcuts
        </button>
      </div>
    </div>
  );
}
