"use server";

import { revalidatePath } from "next/cache";
import { getCurrentTenant } from "@/lib/auth/current-tenant";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { deleteFromR2 } from "@/lib/r2";
import { enrollPerson, addReferenceFace } from "@/lib/people/enrollment";

type BBox = { left: number; top: number; width: number; height: number };

/** Person archive is a business-tier capability. Gate every action. */
async function requireBusinessTenant() {
  const ctx = await getCurrentTenant();
  if (!ctx) throw new Error("ต้องเข้าสู่ระบบ");
  if (ctx.tenant.plan !== "business") {
    throw new Error("ฟีเจอร์สารบัญบุคคลต้องใช้ Business tier");
  }
  return ctx;
}

export async function enrollPersonAction(formData: FormData) {
  const ctx = await requireBusinessTenant();
  const name = (formData.get("name") as string)?.trim();
  const sourcePhotoId = formData.get("sourcePhotoId") as string;
  const bbox = JSON.parse(formData.get("bbox") as string) as BBox;
  if (!name) throw new Error("ต้องระบุชื่อ");

  const result = await enrollPerson({ tenantId: ctx.tenant.id, name, sourcePhotoId, bbox });
  revalidatePath("/dashboard/people");
  return result;
}

export async function addTaggedRefFaceAction(formData: FormData) {
  const ctx = await requireBusinessTenant();
  const personId = formData.get("personId") as string;
  await addReferenceFace({
    tenantId: ctx.tenant.id,
    personId,
    source: "tagged",
    sourcePhotoId: formData.get("sourcePhotoId") as string,
    eventId: formData.get("eventId") as string,
    bbox: JSON.parse(formData.get("bbox") as string) as BBox,
  });
  revalidatePath(`/dashboard/people/${personId}`);
}

export async function addUploadedRefFaceAction(formData: FormData) {
  const ctx = await requireBusinessTenant();
  const personId = formData.get("personId") as string;
  const file = formData.get("file") as File;
  if (!file || file.size === 0) throw new Error("ไม่พบไฟล์");

  await addReferenceFace({
    tenantId: ctx.tenant.id,
    personId,
    source: "uploaded",
    uploadedImageBuffer: Buffer.from(await file.arrayBuffer()),
  });
  revalidatePath(`/dashboard/people/${personId}`);
}

export async function deleteRefFaceAction(refFaceId: string) {
  const ctx = await requireBusinessTenant();
  const supabase = createServiceRoleClient();

  const { data: row } = await supabase
    .from("person_reference_faces")
    .select("r2_key, person_id")
    .eq("id", refFaceId)
    .eq("tenant_id", ctx.tenant.id)
    .single();
  if (!row) throw new Error("ไม่พบ reference face");

  await deleteFromR2(row.r2_key); // remove the crop before the row
  await supabase
    .from("person_reference_faces")
    .delete()
    .eq("id", refFaceId)
    .eq("tenant_id", ctx.tenant.id);

  revalidatePath(`/dashboard/people/${row.person_id}`);
}

export async function deletePersonAction(personId: string) {
  const ctx = await requireBusinessTenant();
  const supabase = createServiceRoleClient();

  // Delete R2 crops first (DB cascade can't reach object storage), then the
  // person row — ON DELETE CASCADE clears ref faces, photo_people, and scans.
  const { data: refFaces } = await supabase
    .from("person_reference_faces")
    .select("r2_key")
    .eq("person_id", personId)
    .eq("tenant_id", ctx.tenant.id);

  for (const rf of refFaces ?? []) {
    await deleteFromR2(rf.r2_key);
  }

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", personId)
    .eq("tenant_id", ctx.tenant.id);
  if (error) throw error;

  revalidatePath("/dashboard/people");
}
