'use client';

import React, { useState } from 'react';
import JarvisPanel from './JarvisPanel';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  Cpu,
  Terminal,
  Layers,
  HardDrive,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';

interface InfoListPanelProps {
  title: string;
  items: string[];
}

const getSpecIcon = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('os') || lower.includes('distro') || lower.includes('kali')) {
    return <ShieldCheck size={12} className="text-emerald-400 shrink-0" />;
  }
  if (lower.includes('cpu') || lower.includes('processor') || lower.includes('cores')) {
    return <Cpu size={12} className="text-primary shrink-0" />;
  }
  if (lower.includes('arch') || lower.includes('kernel')) {
    return <Layers size={12} className="text-accent shrink-0" />;
  }
  if (lower.includes('disk') || lower.includes('memory') || lower.includes('ram')) {
    return <HardDrive size={12} className="text-accent shrink-0" />;
  }
  return <Terminal size={12} className="text-primary/70 shrink-0" />;
};

const InfoListPanel: React.FC<InfoListPanelProps> = ({ title, items }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (item: string, index: number) => {
    soundFx.playClick(1100);
    navigator.clipboard?.writeText(item);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <JarvisPanel title={title} badge={`${items.length} ACTIVE`} className="w-72 p-2.5 pt-5">
      <ul className="space-y-0.5 text-xs text-foreground/85 font-mono pr-0.5 pt-0.5">
        {items.map((item, index) => {
          const isCopied = copiedIndex === index;
          return (
            <li
              key={index}
              onClick={() => handleCopy(item, index)}
              className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 transition-all duration-150 hover:bg-primary/15 hover:text-accent cursor-pointer group border border-transparent hover:border-primary/25"
              title={`Click to copy: ${item}`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getSpecIcon(item)}
                {item.includes(': ') ? (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 text-[11px] font-mono">
                    <span className="font-bold text-primary/80 shrink-0">
                      {item.split(': ')[0]}:
                    </span>
                    <span className="text-foreground/90 truncate font-semibold" title={item.split(': ').slice(1).join(': ')}>
                      {item.split(': ').slice(1).join(': ')}
                    </span>
                  </div>
                ) : (
                  <span className="truncate text-[11px] leading-tight font-sans text-foreground/90 group-hover:text-foreground">
                    {item}
                  </span>
                )}
              </div>

              <div className="shrink-0 text-muted-foreground group-hover:text-accent">
                {isCopied ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </JarvisPanel>
  );
};

export default InfoListPanel;
