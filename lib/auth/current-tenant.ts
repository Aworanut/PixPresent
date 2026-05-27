import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentTenant = {
  user: { id: string; email: string | undefined };
  tenant: {
    id: string;
    name: string;
    plan: string;
    credit_balance: number;
  };
};

export const getCurrentTenant = cache(
  async (): Promise<CurrentTenant | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, plan, credit_balance")
      .eq("owner_user_id", user.id)
      .single();

    if (!tenant) return null;

    return {
      user: { id: user.id, email: user.email },
      tenant,
    };
  },
);
