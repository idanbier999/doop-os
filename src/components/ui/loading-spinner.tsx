const sizeMap: Record<string, string> = {
  sm: "text-base",
  md: "text-2xl",
  lg: "text-4xl",
};

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin font-[family-name:var(--font-pixel)] text-mac-black select-none ${sizeMap[size]} ${className}`}
      aria-label="Loading"
      role="status"
    >
      &#9676;
    </span>
  );
}
