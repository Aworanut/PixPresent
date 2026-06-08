"use client";

import { useState } from "react";
import { Google } from "@thesvg/react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type GoogleSignInButtonProps = {
  label?: string;
};

export function GoogleSignInButton({
  label = "Sign in with Google",
}: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/drive.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (oauthError) {
      setError(oauthError.message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={handleClick}
      >
        <Google aria-hidden="true" className="size-4" />
        {pending ? "กำลังเปิด Google..." : label}
      </Button>
      {error && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
