import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-orange-600",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-canvas text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export type CertificateDisplayStatus = "valid" | "revoked" | "expired";

const statusMap: Record<CertificateDisplayStatus, { tone: BadgeTone; label: string }> = {
  valid: { tone: "success", label: "Válido" },
  revoked: { tone: "danger", label: "Revogado" },
  expired: { tone: "warning", label: "Vencido" },
};

export function StatusBadge({ status }: { status: CertificateDisplayStatus }) {
  const { tone, label } = statusMap[status];
  return <Badge tone={tone}>{label}</Badge>;
}
