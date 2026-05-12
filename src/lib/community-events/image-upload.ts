import { put } from "@vercel/blob";

export const MAX_EVENT_IMAGE_BYTES = 8 * 1024 * 1024;

export function safeEventImageFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "image"
  );
}

export function validateEventImageFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "El archivo debe ser una imagen";
  }
  if (file.size > MAX_EVENT_IMAGE_BYTES) {
    return "La imagen no puede superar 8 MB";
  }
  return null;
}

export async function uploadEventImageBlob(eventId: string, file: File) {
  return put(
    `community-events/${eventId}/${Date.now()}-${safeEventImageFilename(file.name)}`,
    file,
    {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    }
  );
}
