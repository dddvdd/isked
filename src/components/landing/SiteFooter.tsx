import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted-foreground">
        <p>
          © 2026{" "}
          <span className="font-brand font-semibold text-foreground">
            Isked
          </span>
          . All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Data Privacy Notice (RA 10173)
          </Link>
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms of Use
          </Link>
        </div>
      </div>
    </footer>
  );
}

