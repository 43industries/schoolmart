import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
}

export function Logo({ href = "/", className, size = "md", showWordmark = true }: LogoProps) {
  const markSize = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-11 w-11 text-base" : "h-9 w-9 text-sm";
  const wordSize = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("relative flex items-center justify-center rounded-xl bg-brand-teal font-bold text-white shadow-sm", markSize)}>
        SM
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-gold ring-2 ring-white"
          aria-hidden
        />
      </span>
      {showWordmark && (
        <span className={cn("font-bold tracking-tight text-brand-ink", wordSize)}>
          School<span className="text-brand-teal">Mart</span>
        </span>
      )}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
