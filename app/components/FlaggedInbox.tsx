"use client";

import { useState } from "react";
import FlaggedRow from "@/app/components/FlaggedRow";
import type { Capture, MenuItem } from "@/types";

export interface FlaggedItem {
  capture: Capture;
  siteName: string;
  orgName?: string;
  dayPartLabel: string;
  menuItems: MenuItem[];
}

export default function FlaggedInbox({ items: initialItems }: { items: FlaggedItem[] }) {
  const [items, setItems] = useState(initialItems);

  function handleResolved(captureId: string) {
    setItems((prev) => prev.filter((item) => item.capture.id !== captureId));
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-brand border-[1.5px] border-dashed border-border-default px-3 py-10 text-center">
        <p className="text-sm text-muted">No flagged photos right now.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <FlaggedRow
          key={item.capture.id}
          capture={item.capture}
          siteName={item.siteName}
          orgName={item.orgName}
          dayPartLabel={item.dayPartLabel}
          menuItems={item.menuItems}
          onResolved={handleResolved}
        />
      ))}
    </div>
  );
}
