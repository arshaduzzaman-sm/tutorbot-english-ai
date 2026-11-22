import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  info: "border-accent-blue/30 bg-blue-50 text-[#1e3a8a]",
  success: "border-success/30 bg-green-50 text-[#14532d]",
  warning: "border-warning/30 bg-amber-50 text-[#713f12]",
  danger: "border-danger/30 bg-red-50 text-[#7f1d1d]",
};

export function Alert({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: keyof typeof tones }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}
      {...props}
    />
  );
}
