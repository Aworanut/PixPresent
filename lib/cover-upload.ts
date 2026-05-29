import {
  COVER_MAX_BYTES,
  processCroppedCover,
} from "@/lib/image-processing";
import { parseCropFromForm, type CropPixels } from "@/lib/crop";

export const ALLOWED_COVER_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_COVER_INPUT_BYTES = 20 * 1024 * 1024;

type CoverStorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Buffer,
        options: { contentType: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

export async function uploadEventCover(
  supabase: CoverStorageClient,
  userId: string,
  eventId: string,
  coverFile: FormDataEntryValue | null,
  existingCoverUrl: string,
  crop: CropPixels | null,
): Promise<
  | { coverUrl: string | null; error?: undefined }
  | { coverUrl?: undefined; error: string }
> {
  if (!(coverFile instanceof File) || coverFile.size === 0) {
    return { coverUrl: existingCoverUrl.trim() || null };
  }

  if (!ALLOWED_COVER_TYPES.has(coverFile.type)) {
    return { error: "รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF" };
  }
  if (coverFile.size > MAX_COVER_INPUT_BYTES) {
    return { error: "รูปต้นฉบับใหญ่เกิน 20 MB กรุณาเลือกรูปที่เล็กลง" };
  }
  if (!crop) {
    return { error: "กรุณาปรับ crop รูปปกก่อนบันทึก" };
  }

  try {
    const raw = Buffer.from(await coverFile.arrayBuffer());
    const processed = await processCroppedCover(raw, crop, COVER_MAX_BYTES);
    const objectPath = `${userId}/covers/${eventId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(objectPath, processed.buffer, {
        contentType: processed.contentType,
        upsert: true,
      });

    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(objectPath);

    return { coverUrl: `${publicUrl}?v=${Date.now()}` };
  } catch (err) {
    console.error("[cover-upload] Crop/compress failed:", err);
    return { error: "ไม่สามารถบีบอัดรูปปกได้ กรุณาเลือกรูปอื่น" };
  }
}

export function parseCoverCrop(formData: FormData): CropPixels | null {
  return parseCropFromForm(formData, "cover_crop");
}
