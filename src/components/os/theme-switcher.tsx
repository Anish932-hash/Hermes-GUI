'use client';

import React, { useEffect, useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Palette, Sparkles, Check } from 'lucide-react';
import { soundFx } from '@/lib/audio-synth';
import { cn } from '@/lib/utils';
import { orbitron } from '@/lib/fonts';

export interface HologramTheme {
  id: string;
  name: string;
  suitCode: string;
  primary: string;
  accent: string;
  secondary: string;
  border: string;
  ring: string;
  glow: string;
  swatchHex: string;
}

export const THEMES: HologramTheme[] = [
  {
    id: 'cyan',
    name: 'ARC REACTOR',
    suitCode: 'MARK-XV',
    primary: '182 100% 50%',
    accent: '188 100% 60%',
    secondary: '188 100% 40%',
    border: '182 95% 30%',
    ring: '182 100% 50%',
    glow: 'hsl(182 100% 50% / 0.4)',
    swatchHex: '#00f2fe',
  },
  {
    id: 'gold',
    name: 'STARK GOLD',
    suitCode: 'MARK-VII',
    primary: '43 96% 56%',
    accent: '38 92% 50%',
    secondary: '28 90% 45%',
    border: '43 90% 30%',
    ring: '43 96% 56%',
    glow: 'hsl(43 96% 56% / 0.4)',
    swatchHex: '#fbbf24',
  },
  {
    id: 'crimson',
    name: 'HULKBUSTER',
    suitCode: 'MARK-XLIV',
    primary: '0 84% 60%',
    accent: '15 100% 55%',
    secondary: '350 85% 45%',
    border: '0 80% 32%',
    ring: '0 84% 60%',
    glow: 'hsl(0 84% 60% / 0.4)',
    swatchHex: '#ef4444',
  },
  {
    id: 'emerald',
    name: 'KALI MATRIX',
    suitCode: 'STEALTH-IX',
    primary: '142 76% 50%',
    accent: '150 100% 55%',
    secondary: '160 84% 39%',
    border: '142 70% 28%',
    ring: '142 76% 50%',
    glow: 'hsl(142 76% 50% / 0.4)',
    swatchHex: '#10b981',
  },
  {
    id: 'violet',
    name: 'QUANTUM NEBULA',
    suitCode: 'MARK-L',
    primary: '270 95% 65%',
    accent: '290 100% 70%',
    secondary: '250 85% 55%',
    border: '270 80% 35%',
    ring: '270 95% 65%',
    glow: 'hsl(270 95% 65% / 0.4)',
    swatchHex: '#a855f7',
  },
];

export const ThemeSwitcher: React.FC = () => {
  const [currentThemeId, setCurrentThemeId] = useState<string>('cyan');

  const applyTheme = (theme: HologramTheme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--ring', theme.ring);
    root.style.setProperty('--chart-1', theme.primary);
    root.style.setProperty('--chart-2', theme.accent);
    root.style.setProperty('--chart-3', theme.secondary);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hermes_hologram_theme');
      if (saved) {
        const found = THEMES.find((t) => t.id === saved);
        if (found) {
          setCurrentThemeId(saved);
          applyTheme(found);
        }
      }
    }
  }, []);

  const handleSelectTheme = (theme: HologramTheme) => {
    soundFx.playThemeSwitch();
    setCurrentThemeId(theme.id);
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hermes_hologram_theme', theme.id);
    }
  };

  const activeTheme = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={() => soundFx.playClick(950)}
          className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-background/60 px-2 py-1 text-xs font-mono font-bold text-primary transition-all hover:border-accent hover:bg-primary/20 hover:text-accent hover:shadow-[0_0_12px_hsl(var(--primary)/0.3)] backdrop-blur-sm"
          title={`Hologram Armor: ${activeTheme.name} (${activeTheme.suitCode})`}
        >
          <span
            className="h-2.5 w-2.5 rounded-full shadow-sm animate-pulse"
            style={{ backgroundColor: activeTheme.swatchHex }}
          />
          <span className="hidden 2xl:inline text-[10px] font-mono tracking-wider">
            {activeTheme.suitCode}
          </span>
          <Palette size={13} className="text-primary/70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 border-primary/40 bg-background/95 backdrop-blur-xl text-primary font-mono text-xs shadow-[0_0_30px_hsl(var(--primary)/0.3)] z-50">
        <DropdownMenuLabel className="flex items-center justify-between text-[10px] text-muted-foreground tracking-widest font-mono">
          <span>HOLOGRAPHIC ARMOR HUD</span>
          <Sparkles size={11} className="text-accent" />
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-primary/20" />
        {THEMES.map((theme) => {
          const isSelected = theme.id === currentThemeId;
          return (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => handleSelectTheme(theme)}
              className={cn(
                'flex items-center justify-between py-2 cursor-pointer transition-all hover:bg-primary/20 hover:text-accent',
                isSelected && 'bg-primary/15 font-bold text-accent'
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3 w-3 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: theme.swatchHex }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold leading-none">{theme.name}</span>
                  <span className="text-[9px] text-muted-foreground">{theme.suitCode}</span>
                </div>
              </div>
              {isSelected && <Check size={14} className="text-accent" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
