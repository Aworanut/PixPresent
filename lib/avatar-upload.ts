import {
  AVATAR_MAX_BYTES,
  processCroppedAvatar,
} from "@/lib/image-processing";
import { parseCropFromForm, type CropPixels } from "@/lib/crop";
import { isStoredAvatarUrl } from "@/lib/avatar-url";

export const ALLOWED_AVATAR_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_AVATAR_INPUT_BYTES = 20 * 1024 * 1024;

type AvatarStorageClient = {
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

export async function uploadUserAvatar(
  supabase: AvatarStorageClient,
  userId: string,
  avatarFile: FormDataEntryValue | null,
  existingAvatarUrl: string,
  crop: CropPixels | null,
): Promise<
  | { avatarUrl: string | null; error?: undefined }
  | { avatarUrl?: undefined; error: string }
> {
  if (!(avatarFile instanceof File) || avatarFile.size === 0) {
    const kept = existingAvatarUrl.trim();
    return { avatarUrl: isStoredAvatarUrl(kept) ? kept : null };
  }

  if (!ALLOWED_AVATAR_TYPES.has(avatarFile.type)) {
    return { error: "รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ GIF" };
  }
  if (avatarFile.size > MAX_AVATAR_INPUT_BYTES) {
    return { error: "รูปต้นฉบับใหญ่เกิน 20 MB กรุณาเลือกรูปที่เล็กลง" };
  }
  if (!crop) {
    return { error: "กรุณาปรับ crop รูปก่อนบันทึก" };
  }

  try {
    const raw = Buffer.from(await avatarFile.arrayBuffer());
    const processed = await processCroppedAvatar(raw, crop, AVATAR_MAX_BYTES);
    const objectPath = `${userId}/avatar.jpg`;

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

    return { avatarUrl: `${publicUrl}?v=${Date.now()}` };
  } catch {
    return { error: "ไม่สามารถบีบอัดรูปให้พอดีกับระบบได้ กรุณาเลือกรูปอื่น" };
  }
}

export function parseAvatarCrop(formData: FormData): CropPixels | null {
  return parseCropFromForm(formData, "avatar_crop");
}
