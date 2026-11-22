import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-primary">
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent-purple text-sm text-white"
      >
        PM
      </span>
      <span className="text-lg">PTE Master AI</span>
    </Link>
  );
}
