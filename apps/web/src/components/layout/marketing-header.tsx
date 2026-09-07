import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          <Link href="/how-it-works" className="text-sm font-medium text-brand-muted hover:text-brand-teal">How it works</Link>
          <Link href="/for-parents" className="text-sm font-medium text-brand-muted hover:text-brand-teal">For Parents</Link>
          <Link href="/for-schools" className="text-sm font-medium text-brand-muted hover:text-brand-teal">For Schools</Link>
          <Link href="/for-vendors" className="text-sm font-medium text-brand-muted hover:text-brand-teal">For Vendors</Link>
          <Link href="/faq" className="text-sm font-medium text-brand-muted hover:text-brand-teal">FAQ</Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-brand-muted hover:text-brand-ink">
            Log in
          </Link>
          <Button href="/register">Get Started</Button>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-gray-100 bg-brand-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4">
              <Logo href="/" />
            </div>
            <p className="text-sm text-brand-muted">
              Connecting parents to their children at school through trusted commerce and delivery.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-brand-ink">Platform</h4>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li><Link href="/how-it-works" className="hover:text-brand-teal">How it works</Link></li>
              <li><Link href="/for-parents" className="hover:text-brand-teal">For Parents</Link></li>
              <li><Link href="/for-schools" className="hover:text-brand-teal">For Schools</Link></li>
              <li><Link href="/for-vendors" className="hover:text-brand-teal">For Vendors</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-brand-ink">Support</h4>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li><Link href="/faq" className="hover:text-brand-teal">FAQ</Link></li>
              <li><Link href="/contact" className="hover:text-brand-teal">Contact</Link></li>
              <li><Link href="/about" className="hover:text-brand-teal">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-semibold text-brand-ink">Get started</h4>
            <p className="mb-4 text-sm text-brand-muted">
              Join parents, schools, and vendors already on SchoolMart.
            </p>
            <Button href="/register">Create account</Button>
          </div>
        </div>
        <div className="mt-10 border-t border-gray-200 pt-6 text-center text-sm text-brand-muted">
          &copy; {new Date().getFullYear()} SchoolMart. Built for Kenyan schools.
        </div>
      </div>
    </footer>
  );
}
