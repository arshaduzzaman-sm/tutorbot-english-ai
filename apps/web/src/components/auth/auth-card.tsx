export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-[var(--radius-card)] border border-border bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-primary">{title}</h1>
        {children}
      </div>
    </div>
  );
}
