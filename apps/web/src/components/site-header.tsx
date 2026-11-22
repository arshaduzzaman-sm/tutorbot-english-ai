import { BookOpen, LayoutDashboard, LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const t = await getTranslations("common");
  const tn = await getTranslations("nav");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Logo />
        <nav aria-label={tn("main")} className="flex flex-wrap items-center gap-2">
          {user ? (
            <>
              <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <LayoutDashboard aria-hidden="true" className="size-4" />
                {t("dashboard")}
              </Link>
              <Link href="/lessons" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <BookOpen aria-hidden="true" className="size-4" />
                {tn("lessons")}
              </Link>
              <Link href="/profile" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <UserRound aria-hidden="true" className="size-4" />
                {t("profile")}
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {t("logout")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <LogIn aria-hidden="true" className="size-4" />
                {t("login")}
              </Link>
              <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
                {t("register")}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
