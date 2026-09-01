'use client';

import { useState, type ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
}

export default function Tabs({ tabs }: TabsProps) {
  const [active, setActive] = useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) || tabs[0];

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2.5 text-[0.92rem] font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab.key === activeTab?.key
                ? 'border-navy text-navy'
                : 'border-transparent text-ink-faint hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{activeTab?.content}</div>
    </div>
  );
}
