import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

export const DM_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
export const DM_MAX_FILES = 3;
export const DM_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DM_MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export type DmAttachmentPayload = { fileName: string; dataBase64: string };
export type DmAttachmentView = {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
  expiresAt: Date | string;
  deletedAt?: Date | string | null;
  previewUrl?: string;
};

export function formatFileSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)}MB`
    : `${Math.ceil(size / 1024)}KB`;
}

export function validateSelectedFiles(current: File[], incoming: File[]) {
  const files = [...current, ...incoming];
  if (files.length > DM_MAX_FILES) throw new Error("添付は最大3ファイルです");
  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);
  if (files.some(file => !allowed.has(file.type)))
    throw new Error("PDF、JPEG、PNG、WebPのみ添付できます");
  if (files.some(file => file.size > DM_MAX_FILE_BYTES))
    throw new Error("1ファイル10MB以下にしてください");
  if (files.reduce((sum, file) => sum + file.size, 0) > DM_MAX_TOTAL_BYTES)
    throw new Error("添付ファイルの合計は20MB以下にしてください");
  return files;
}

export async function filesToPayload(
  files: File[]
): Promise<DmAttachmentPayload[]> {
  return Promise.all(
    files.map(
      file =>
        new Promise<DmAttachmentPayload>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () =>
            reject(new Error(`${file.name}を読み込めませんでした`));
          reader.onload = () =>
            resolve({
              fileName: file.name,
              dataBase64: String(reader.result).split(",")[1] ?? "",
            });
          reader.readAsDataURL(file);
        })
    )
  );
}

export function AttachmentPicker({
  inputRef,
  files,
  onFiles,
  disabled = false,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  files: File[];
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onFiles(Array.from(event.target.files));
    event.target.value = "";
  };
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={DM_ACCEPT}
        multiple
        className="hidden"
        onChange={change}
      />
      <button
        type="button"
        disabled={disabled || files.length >= DM_MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="grid size-10 shrink-0 place-items-center text-[#526176] hover:text-[#173f70] disabled:opacity-35"
        aria-label="ファイルを添付"
        title="ファイルを添付"
      >
        <Paperclip size={19} />
      </button>
    </>
  );
}

export function AttachmentSelection({
  files,
  onRemove,
  error,
  compact = false,
}: {
  files: File[];
  onRemove: (index: number) => void;
  error?: string | null;
  compact?: boolean;
}) {
  return (
    <>
      {!!files.length && (
        <div
          className={`mb-2 grid gap-1.5 ${compact ? "text-[11px]" : "text-xs"}`}
        >
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 border border-[#ccd6e1] bg-[#f7f9fb] px-2.5 py-2 text-[#334a66]"
            >
              {file.type === "application/pdf" ? (
                <FileText size={15} />
              ) : (
                <ImageIcon size={15} />
              )}
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-[#718096]">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label="添付を取り消す"
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <p className="text-[10px] text-[#718096]">
            添付ファイルは送信から7日後に自動削除されます
          </p>
        </div>
      )}
      {error && <p className="mb-1.5 text-[11px] text-red-600">{error}</p>}
    </>
  );
}

export function MessageAttachments({
  attachments,
  mine = false,
}: {
  attachments?: DmAttachmentView[];
  mine?: boolean;
}) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-1.5 grid gap-1.5">
      {attachments.map(file => {
        const expired =
          !!file.deletedAt || new Date(file.expiresAt).getTime() <= Date.now();
        if (expired)
          return (
            <div
              key={file.id}
              className={`border px-3 py-2 text-[11px] ${mine ? "border-white/30 text-white/75" : "border-[#d9e0e8] bg-[#f3f5f7] text-[#718096]"}`}
            >
              📎 {file.fileName}
              <br />
              保存期限が終了しました
            </div>
          );
        const url = file.previewUrl ?? `/api/dm-attachments/${file.id}`;
        return (
          <div
            key={file.id}
            className={`border p-2 text-[11px] ${mine ? "border-white/40 text-white" : "border-[#cbd5df] bg-white text-[#173f70]"}`}
          >
            {file.mimeType.startsWith("image/") && (
              <img
                src={url}
                alt=""
                className="mb-2 max-h-36 max-w-full object-contain"
              />
            )}
            <a href={`${url}?download=1`} className="flex items-center gap-2">
              {file.mimeType === "application/pdf" ? (
                <FileText size={16} />
              ) : (
                <ImageIcon size={16} />
              )}
              <span className="min-w-0 flex-1 truncate font-semibold">
                {file.fileName}
              </span>
              <span className="shrink-0 opacity-70">
                {formatFileSize(file.size)}
              </span>
            </a>
            <p className="mt-1 opacity-65">
              {new Date(file.expiresAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              まで保存
            </p>
          </div>
        );
      })}
    </div>
  );
}
