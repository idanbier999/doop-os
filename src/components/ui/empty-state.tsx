import { type ReactNode } from "react";

export interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon ?? (
        <div className="mb-4 text-4xl font-[family-name:var(--font-pixel)] text-mac-gray select-none">
          &#9744;
        </div>
      )}
      <h3 className="text-lg font-bold text-mac-black font-[family-name:var(--font-pixel)]">{message}</h3>
      {description && (
        <p className="mt-1 text-sm text-mac-dark-gray max-w-sm">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 inline-flex items-center rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 text-sm font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
