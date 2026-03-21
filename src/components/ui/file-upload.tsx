"use client";

import { useState, useRef, useCallback } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export interface UploadedFile {
  id?: string;
  name: string;
  path: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  error?: string;
}

const DEFAULT_ALLOWED_TYPES = [
  "application/pdf",
  "application/json",
  "text/plain",
  "text/csv",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/zip",
  "application/x-yaml",
];

export interface FileUploadProps {
  workspaceId: string;
  projectId: string;
  onFilesUploaded?: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  existingFiles?: UploadedFile[];
  accept?: string[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  workspaceId,
  projectId,
  onFilesUploaded,
  maxFiles = 10,
  maxSizeMB = 50,
  existingFiles = [],
  accept = DEFAULT_ALLOWED_TYPES,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile> => {
      const storagePath = `${workspaceId}/${projectId}/${file.name}`;
      const uploadedFile: UploadedFile = {
        name: file.name,
        path: storagePath,
        size: file.size,
        type: file.type,
        status: "uploading",
        progress: 0,
      };

      setFiles((prev) => [...prev, uploadedFile]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("bucket", "project-files");
        formData.append("path", storagePath);

        const res = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(body.error ?? `Upload failed (${res.status})`);
        }

        const data = await res.json();

        const completed: UploadedFile = {
          ...uploadedFile,
          id: data.id,
          status: "complete",
          progress: 100,
        };

        setFiles((prev) => prev.map((f) => (f.path === storagePath ? completed : f)));

        return completed;
      } catch (err) {
        const failed: UploadedFile = {
          ...uploadedFile,
          status: "error",
          progress: 0,
          error: err instanceof Error ? err.message : "Upload failed",
        };

        setFiles((prev) => prev.map((f) => (f.path === storagePath ? failed : f)));

        return failed;
      }
    },
    [workspaceId, projectId]
  );

  const handleFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      const valid = arr.filter((f) => {
        if (f.size > maxSizeBytes) return false;
        if (accept.length > 0 && !accept.includes(f.type)) return false;
        return true;
      });

      const remaining = maxFiles - files.filter((f) => f.status === "complete").length;
      const toUpload = valid.slice(0, remaining);

      const results = await Promise.all(toUpload.map(uploadFile));
      onFilesUploaded?.(results.filter((f) => f.status === "complete"));
    },
    [files, maxFiles, maxSizeMB, accept, uploadFile, onFilesUploaded]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = async (file: UploadedFile) => {
    if (file.status === "complete") {
      await fetch(`/api/files/project-files/${file.path}`, {
        method: "DELETE",
      }).catch(() => {
        // Best-effort removal — don't block UI
      });
    }
    setFiles((prev) => prev.filter((f) => f.path !== file.path));
  };

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-mac-highlight bg-mac-highlight-soft"
            : "border-mac-border hover:border-mac-dark-gray"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept.join(",")}
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="mb-2 text-2xl font-[family-name:var(--font-pixel)] text-mac-gray select-none">
          &#8613;
        </div>
        <p className="text-mac-dark-gray font-body text-sm">
          Drag &amp; drop files here, or{" "}
          <span className="text-mac-highlight underline">browse</span>
        </p>
        <p className="mt-1 text-xs text-mac-gray">
          Max {maxFiles} files &bull; Up to {maxSizeMB}MB each
        </p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.path}
              className="flex flex-col gap-1 p-2 border border-mac-border rounded bg-mac-white"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm shrink-0">&#128196;</span>
                  <span className="text-sm font-body truncate">{file.name}</span>
                  <span className="text-xs text-mac-gray shrink-0">{formatSize(file.size)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {file.status === "uploading" && <LoadingSpinner size="sm" />}
                  {file.status === "complete" && (
                    <span className="text-green-600 text-sm font-[family-name:var(--font-pixel)]">
                      &#10003;
                    </span>
                  )}
                  {file.status === "error" && (
                    <span className="text-severity-critical text-sm font-[family-name:var(--font-pixel)]">
                      !
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file);
                    }}
                    className="text-mac-gray hover:text-severity-critical transition-colors text-sm leading-none px-1"
                    aria-label={`Remove ${file.name}`}
                  >
                    &#10005;
                  </button>
                </div>
              </div>

              {file.status === "uploading" && (
                <div className="h-[2px] bg-mac-light-gray rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mac-highlight rounded-full transition-all"
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              )}

              {file.status === "error" && file.error && (
                <p className="text-xs text-severity-critical">{file.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
