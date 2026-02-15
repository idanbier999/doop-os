import { type ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
  onClose?: () => void;
}

export function Card({ children, title, className = "", onClose }: CardProps) {
  return (
    <div className={`mac-window ${className}`}>
      {title && (
        <div className="mac-title-bar">
          {onClose ? (
            <button onClick={onClose} className="mac-close-box" aria-label="Close" />
          ) : (
            <div className="mac-close-box" />
          )}
          <span className="mac-title-bar-title">{title}</span>
        </div>
      )}
      <div className="p-4 bg-mac-white">
        {children}
      </div>
    </div>
  );
}

export interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return (
    <div className={`mb-3 ${className}`}>
      {children}
    </div>
  );
}

export interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

export function CardBody({ children, className = "" }: CardBodyProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
