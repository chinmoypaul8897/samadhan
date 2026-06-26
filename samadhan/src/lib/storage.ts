import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase-client";

// Firebase Storage web upload (firebase.google.com/docs/storage/web/upload-files).
// Path is uid-scoped so the Storage rule can enforce auth.uid == {uid} (data-shapes §7).

export type MediaResult = {
  path: string;
  downloadUrl: string;
  contentType: string;
  sizeBytes: number;
};
export type UploadProgress = (pct: number) => void;

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;
const MAX_BYTES = 5 * 1024 * 1024; // matches the storage.rules cap

// Downscale a phone photo to ≤1280px longest edge as JPEG to stay under the 5 MB
// storage-rule cap and to keep the C3 Gemini call fast. DEFENSIVE: any decode
// failure (e.g. HEIC the browser can't decode) falls back to the original file —
// we never lose the photo. sizeBytes/contentType are read from the returned blob.
export async function downscaleImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_EDGE / longest);
    if (scale === 1 && file.size <= MAX_BYTES) {
      bitmap.close?.();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close?.();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Resumable upload of a blob to an exact Storage path. Returns path + tokened downloadUrl. */
export async function uploadImage(
  path: string,
  blob: Blob,
  onProgress?: UploadProgress,
): Promise<MediaResult> {
  const contentType = blob.type || "image/jpeg";
  const task = uploadBytesResumable(ref(storage, path), blob, { contentType });

  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) =>
        onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });

  const downloadUrl = await getDownloadURL(task.snapshot.ref);
  return { path, downloadUrl, contentType, sizeBytes: blob.size };
}

/** Citizen capture photo → reports/{uid}/{reportId}/original.jpg (data-shapes §7). */
export function uploadReportPhoto(
  uid: string,
  reportId: string,
  blob: Blob,
  onProgress?: UploadProgress,
): Promise<MediaResult> {
  return uploadImage(`reports/${uid}/${reportId}/original.jpg`, blob, onProgress);
}

/** Officer proof-of-fix → issues/{issueId}/after/{uid}.jpg (C8; staff-write Storage rule). */
export function uploadAfterPhoto(
  issueId: string,
  uid: string,
  blob: Blob,
  onProgress?: UploadProgress,
): Promise<MediaResult> {
  return uploadImage(`issues/${issueId}/after/${uid}.jpg`, blob, onProgress);
}
