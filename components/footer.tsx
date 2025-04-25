import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t py-4 mt-auto">
      <div className="container flex flex-col items-center justify-center gap-2 md:flex-row md:justify-between">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Campaign Portal. All rights reserved.
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  )
}
