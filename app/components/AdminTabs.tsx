"use client";

import { useState } from "react";

export interface AdminTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export default function AdminTabs({ tabs }: { tabs: AdminTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-border-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={
              tab.id === activeTab?.id
                ? "border-b-2 border-brand pb-2.5 text-sm font-bold text-navy"
                : "border-b-2 border-transparent pb-2.5 text-sm font-semibold text-secondary hover:text-body"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4">{activeTab?.content}</div>
    </div>
  );
}
