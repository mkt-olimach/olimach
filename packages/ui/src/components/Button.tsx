import type { ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** landing: raio 999px. admin: raio 10px. */
  context?: "landing" | "admin";
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-700",
  accent: "bg-orange-500 text-white hover:bg-orange-600",
  secondary: "bg-surface text-navy-900 border border-line hover:bg-canvas",
  ghost: "bg-transparent text-navy-900 hover:bg-canvas",
};

export const buttonClasses = (
  variant: ButtonVariant = "primary",
  context: "landing" | "admin" = "admin",
): string =>
  cn(
    "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    context === "landing" ? "rounded-btn-landing" : "rounded-btn-admin",
    variants[variant],
  );

export function Button({
  variant = "primary",
  context = "admin",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={cn(buttonClasses(variant, context), className)} {...props} />;
}
