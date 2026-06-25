import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "brand" | "outline" | "text";

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-[14px] font-medium transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "rounded-pill bg-primary px-6 py-3 text-on-dark hover:bg-primary/90",
  brand: "rounded-pill bg-brand px-6 py-3 text-on-dark hover:bg-brand/90",
  outline: "rounded-pill border border-primary px-6 py-3 text-primary hover:bg-primary/5",
  text: "px-1 py-1 text-ink underline underline-offset-4 hover:text-link",
};

/** Class string for the button look — use on a <Link> for navigational CTAs. */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cn(base, variants[variant], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClasses(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
