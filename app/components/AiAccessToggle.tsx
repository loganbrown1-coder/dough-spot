"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserAiAccessAction } from "@/lib/actions/admin";

export default function AiAccessToggle({
  userId,
  email,
  enabled,
}: {
  userId: string;
  email: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !on;
    const previous = on;
    setError(null);
    setOn(next);
    startTransition(async () => {
      const result = await setUserAiAccessAction(userId, next);
      if (result.error) {
        setOn(previous);
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`AI access for ${email}`}
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-60 ${
          on ? "bg-brand" : "bg-border-default"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
