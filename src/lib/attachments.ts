import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";

export interface SavedAttachment {
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export async function pickAttachmentPaths(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function copyAttachmentFromPath(
  projectId: string,
  communicationId: string,
  sourcePath: string,
): Promise<SavedAttachment> {
  return invoke<SavedAttachment>("copy_attachment", {
    projectId,
    communicationId,
    sourcePath,
  });
}

export async function saveAttachmentBytes(
  projectId: string,
  communicationId: string,
  fileName: string,
  dataBase64: string,
): Promise<SavedAttachment> {
  return invoke<SavedAttachment>("save_attachment_bytes", {
    projectId,
    communicationId,
    fileName,
    dataBase64,
  });
}

export async function readAttachmentDataUrl(path: string): Promise<string> {
  return invoke<string>("read_attachment_data_url", { path });
}

export async function openAttachment(path: string): Promise<void> {
  await openPath(path);
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function pastedImageFileName(file: File): string {
  const extension =
    file.type === "image/jpeg"
      ? "jpg"
      : file.type === "image/gif"
        ? "gif"
        : file.type === "image/webp"
          ? "webp"
          : "png";
  return `粘贴图片-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
}
