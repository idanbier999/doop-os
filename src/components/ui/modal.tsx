"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:glass-overlay bg-transparent p-0 m-auto max-sm:m-0 max-sm:w-full max-sm:h-full max-sm:max-w-none max-sm:max-h-none"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="border-2 border-mac-border-strong bg-mac-white rounded-lg shadow-[1px_1px_0px_var(--color-mac-shadow),0px_4px_12px_var(--color-mac-shadow-soft)] w-full max-w-lg max-sm:max-w-none max-sm:h-full max-sm:shadow-none">
        <div className="border border-mac-border m-[2px] rounded-md max-sm:h-[calc(100%-4px)] max-sm:flex max-sm:flex-col">
          {title && (
            <div className="mac-title-bar shrink-0">
              <button onClick={onClose} className="mac-close-box" aria-label="Close" />
              <span className="mac-title-bar-title">{title}</span>
            </div>
          )}
          <div className="p-5 text-mac-black max-sm:flex-1 max-sm:overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </dialog>
  );
}
