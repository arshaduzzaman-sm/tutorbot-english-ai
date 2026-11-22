import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-primary">Page not found</h1>
      <p className="mt-2 text-muted-foreground">We could not find this page.</p>
      <Link href="/" className={`${buttonVariants()} mt-6`}>
        Go home
      </Link>
    </div>
  );
}
