"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostAuthRedirect } from "@/lib/auth/onboarding";

export type AuthState = { error: string } | undefined;

function getOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }
  if (password.length < 8) {
    return { error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getOrigin()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่" };

  revalidatePath("/", "layout");
  redirect(await getPostAuthRedirect(data.user.id));
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/", "layout");
  redirect(await getPostAuthRedirect(data.user.id));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "กรุณากรอกอีเมล" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };
  return { error: "" };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  revalidatePath("/", "layout");
  redirect(user ? await getPostAuthRedirect(user.id) : "/dashboard");
}

