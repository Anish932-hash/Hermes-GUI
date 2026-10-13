'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Terminal,
  ImageIcon,
  Maximize2,
  Download,
  Sparkles,
  AlertCircle,
  Info,
  ShieldAlert,
  CheckCircle2,
  Code2,
  FileCode,
  Layers,
  Globe,
  ExternalLink,
  Crosshair,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { soundFx } from '@/lib/audio-synth';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface RichMessageContentProps {
  content: string;
  imageUrl?: string;
  isUser?: boolean;
  onExecuteCommand?: (command: string) => void;
}

// Simple syntax-coloring token helper for code blocks
function highlightCodeLine(line: string, lang: string): React.ReactNode {
  // If line is empty
  if (!line) return <span> </span>;

  // Comment detection
  if (line.trim().startsWith('#') || line.trim().startsWith('//') || line.trim().startsWith('/*')) {
    return <span className="text-muted-foreground/70 italic">{line}</span>;
  }

  // Shell prompt detection
  if (line.trim().startsWith('$ ') || line.trim().startsWith('> ')) {
    const prompt = line.slice(0, 2);
    const rest = line.slice(2);
    return (
      <span>
        <span className="text-emerald-400 font-bold select-none">{prompt}</span>
        <span className="text-foreground">{rest}</span>
      </span>
    );
  }

  // Tokenization for common programming languages
  const keywordRegex = /\b(def|class|import|from|return|if|else|elif|for|while|try|except|finally|const|let|var|function|async|await|switch|case|break|continue|new|throw|export|default|type|interface|public|private)\b/g;
  const stringRegex = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
  const numberRegex = /\b(\d+(?:\.\d+)?)\b/g;
  const booleanRegex = /\b(true|false|null|undefined|None|True|False)\b/g;

  // Split line by string literals first to protect them
  const parts = line.split(stringRegex);

  return (
    <span>
      {parts.map((part, pIdx) => {
        // String literal
        if (part.startsWith('"') || part.startsWith("'") || part.startsWith('`')) {
          return (
            <span key={pIdx} className="text-emerald-400 font-normal">
              {part}
            </span>
          );
        }

        // Sub-tokenize remaining code
        const subTokens = part.split(/(\s+|[(),.:;{}[\]=+\-*/<>!&|^~])/);

        return (
          <span key={pIdx}>
            {subTokens.map((tok, tIdx) => {
              if (keywordRegex.test(tok)) {
                return (
                  <span key={tIdx} className="text-cyan-400 font-bold">
                    {tok}
                  </span>
                );
              }
              if (booleanRegex.test(tok)) {
                return (
                  <span key={tIdx} className="text-amber-400 font-semibold">
                    {tok}
                  </span>
                );
              }
              if (numberRegex.test(tok)) {
                return (
                  <span key={tIdx} className="text-amber-300">
                    {tok}
                  </span>
                );
              }
              if (/[{}()[\]]/.test(tok)) {
                return (
                  <span key={tIdx} className="text-primary font-bold">
                    {tok}
                  </span>
                );
              }
              return <span key={tIdx}>{tok}</span>;
            })}
          </span>
        );
      })}
    </span>
  );
}

// Single Code Block Component with Mac IDE dots, copy, line numbers, and run button
const CodeBlock: React.FC<{
  language: string;
  code: string;
  onExecuteCommand?: (cmd: string) => void;
}> = ({ language, code, onExecuteCommand }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const cleanCode = code.trim();
  const lines = cleanCode.split('\n');

  const handleCopy = () => {
    soundFx.playClick(1000);
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    toast({
      title: "Code Copied",
      description: `Copied ${lines.length} lines of ${language.toUpperCase() || 'CODE'} to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const isShell =
    ['bash', 'sh', 'shell', 'zsh', 'terminal', 'cmd'].includes(language.toLowerCase()) ||
    cleanCode.startsWith('$ ') ||
    cleanCode.startsWith('curl ') ||
    cleanCode.startsWith('npm ') ||
    cleanCode.startsWith('hermes ');

  const handleRun = () => {
    soundFx.playTerminalCommand();
    const cmdToRun = cleanCode.replace(/^\$\s*/, '');
    if (onExecuteCommand) {
      onExecuteCommand(cmdToRun);
    } else {
      navigator.clipboard.writeText(cmdToRun);
      toast({
        title: "Command Prepared",
        description: `"${cmdToRun.slice(0, 40)}..." copied for terminal execution.`,
      });
    }
  };

  const isSvg =
    (language.toLowerCase() === 'svg' ||
      language.toLowerCase() === 'xml' ||
      language.toLowerCase() === 'html') &&
    cleanCode.includes('<svg') &&
    cleanCode.includes('</svg>');

  const [viewMode, setViewMode] = useState<'preview' | 'code'>(isSvg ? 'preview' : 'code');

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-primary/35 bg-background/90 shadow-[0_0_20px_hsl(var(--primary)/0.12)]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between border-b border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-mono">
        <div className="flex items-center gap-2">
          {/* Terminal Window Dots */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>

          <span className="rounded bg-background/80 px-2 py-0.5 text-[10px] font-bold text-accent uppercase tracking-wider border border-primary/20">
            {language || (isShell ? 'BASH' : 'CODE')}
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {lines.length} lines
          </span>

          {isSvg && (
            <div className="flex items-center gap-1 ml-2 border-l border-primary/20 pl-2">
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-bold transition-all',
                  viewMode === 'preview'
                    ? 'bg-accent/20 text-accent border border-accent/40'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                PREVIEW
              </button>
              <button
                type="button"
                onClick={() => setViewMode('code')}
                className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-bold transition-all',
                  viewMode === 'code'
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                CODE
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isShell && (
            <button
              type="button"
              onClick={handleRun}
              className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all cursor-pointer shadow-[0_0_8px_hsl(var(--emerald-400)/0.2)]"
              title="Execute in WSL Terminal"
            >
              <Play size={10} className="fill-emerald-400" />
              <span>RUN IN WSL</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 rounded bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-primary hover:bg-primary/25 hover:text-accent border border-primary/20 transition-all cursor-pointer"
            title="Copy code snippet"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-400" />
                <span className="text-emerald-400 font-bold">COPIED</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SVG Visual Preview Mode */}
      {isSvg && viewMode === 'preview' ? (
        <div className="p-4 bg-black/80 flex items-center justify-center min-h-[160px] overflow-hidden rounded-b-xl border-t border-primary/20">
          <div
            className="max-w-full overflow-auto text-primary"
            dangerouslySetInnerHTML={{ __html: cleanCode }}
          />
        </div>
      ) : (
        /* Code Body with Line Numbers */
        <div className="overflow-x-auto p-3 text-[12px] font-mono leading-relaxed bg-black/60">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-primary/5 transition-colors">
                  <td className="w-8 select-none pr-3 text-right text-[11px] text-muted-foreground/50 border-r border-primary/10">
                    {idx + 1}
                  </td>
                  <td className="pl-3 whitespace-pre font-mono">
                    {highlightCodeLine(line, language)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// AI Generated Visual Artifact Card with Lightbox Zoom
const ImageArtifactCard: React.FC<{
  imageUrl: string;
  caption?: string;
  prompt?: string;
}> = ({ imageUrl, caption, prompt }) => {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    soundFx.playClick(1000);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `hermes-artifact-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Image Downloaded",
      description: "Saved AI generated visual artifact.",
    });
  };

  return (
    <>
      <div className="my-3 overflow-hidden rounded-2xl border border-accent/40 bg-background/80 p-2.5 backdrop-blur-md shadow-[0_0_25px_hsl(var(--accent)/0.15)] group transition-all">
        {/* Artifact Header */}
        <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 mb-2 px-1 text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-accent animate-spin-slow" />
            <span className="font-bold text-accent tracking-wider">
              AI GENERATED VISUAL ARTIFACT // GEMINI MULTIMODAL
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsZoomOpen(true)}
              className="p-1 rounded text-primary hover:bg-primary/20 hover:text-accent transition-colors"
              title="Fullscreen Zoom"
            >
              <Maximize2 size={12} />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-1 rounded text-primary hover:bg-primary/20 hover:text-accent transition-colors"
              title="Download Image"
            >
              <Download size={12} />
            </button>
          </div>
        </div>

        {/* Image Preview with Hover Overlay */}
        <div
          className="relative h-64 sm:h-72 w-full overflow-hidden rounded-xl border border-primary/20 bg-black/40 cursor-pointer"
          onClick={() => setIsZoomOpen(true)}
        >
          <Image
            src={imageUrl}
            alt={caption || prompt || 'AI Generated Artifact'}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <div className="text-white text-xs font-sans">
              <span className="font-bold font-mono text-[10px] text-accent block">PROMPT:</span>
              <p className="line-clamp-2">{caption || prompt || 'Generated visual synthesis'}</p>
            </div>
          </div>
        </div>

        {/* Prompt Caption below */}
        {(caption || prompt) && (
          <div className="mt-2 px-1 text-[11px] text-muted-foreground font-mono flex items-center justify-between">
            <span className="truncate max-w-[80%] italic">"{caption || prompt}"</span>
            <span className="text-[9px] text-accent font-bold">1024×1024 PNG</span>
          </div>
        )}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
        <DialogContent className="max-w-4xl border border-primary/40 bg-background/95 backdrop-blur-2xl p-4 shadow-[0_0_60px_hsl(var(--primary)/0.3)]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm tracking-widest text-accent flex items-center gap-2">
              <ImageIcon size={16} />
              <span>HIGH RESOLUTION VISUAL ARTIFACT PREVIEW</span>
            </DialogTitle>
          </DialogHeader>

          <div className="relative h-[65vh] w-full rounded-xl overflow-hidden border border-primary/30 mt-2">
            <Image
              src={imageUrl}
              alt={caption || prompt || 'AI Generated Artifact Fullview'}
              fill
              className="object-contain"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-primary/20 mt-2">
            <p className="text-xs text-muted-foreground font-sans max-w-xl truncate">
              {caption || prompt || 'Synthesized via Gemini Image Generation Flow'}
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/20 text-xs font-mono font-bold text-accent hover:bg-accent/30 transition-all cursor-pointer"
            >
              <Download size={13} />
              <span>DOWNLOAD ARTIFACT</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Markdown Alert Callouts
const AlertCallout: React.FC<{ type: string; content: string }> = ({ type, content }) => {
  const isWarning = type.includes('WARN') || type.includes('CAUTION');
  const isDestructive = type.includes('CRITICAL') || type.includes('DANGER') || type.includes('IMPORTANT');
  const isTip = type.includes('TIP') || type.includes('SUCCESS');

  return (
    <div
      className={cn(
        'my-2.5 rounded-xl border p-3 font-sans text-xs leading-relaxed flex items-start gap-2.5 shadow-sm',
        isDestructive
          ? 'border-destructive/50 bg-destructive/10 text-destructive/95'
          : isWarning
          ? 'border-amber-400/50 bg-amber-400/10 text-amber-300'
          : isTip
          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
          : 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isDestructive ? (
          <ShieldAlert size={16} className="text-destructive" />
        ) : isWarning ? (
          <AlertCircle size={16} className="text-amber-400" />
        ) : isTip ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <Info size={16} className="text-cyan-400" />
        )}
      </div>
      <div className="flex-1">
        <div className="font-mono font-bold text-[10px] tracking-widest uppercase mb-0.5">
          {type.replace(/[[\]!]/g, '') || 'NOTE'}
        </div>
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
};

// God's Eye View 3D Target Recon Card
export const GodsEyeTargetCard: React.FC<{
  rawJson: string;
}> = ({ rawJson }) => {
  let targetData: any = {};
  try {
    const cleaned = rawJson.replace(/```[a-z0-9_-]*\s*/gi, '').replace(/```/g, '').trim();
    targetData = JSON.parse(cleaned);
  } catch {
    targetData = { target: 'Geospatial Recon Target', lat: 0, lon: 0, alt: 22000000 };
  }

  const { target, lat, lon, alt = 1800, pitch = -45, heading = 0, category, address, details } = targetData;
  const targetLat = typeof lat === 'number' ? lat : parseFloat(lat) || 0;
  const targetLon = typeof lon === 'number' ? lon : parseFloat(lon) || 0;
  const targetAlt = typeof alt === 'number' ? alt : parseFloat(alt) || 1800;
  const targetPitch = typeof pitch === 'number' ? pitch : parseFloat(pitch) || -45;
  const targetHeading = typeof heading === 'number' ? heading : parseFloat(heading) || 0;

  const handleOpenInUI = () => {
    soundFx.playClick(1100);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('hermes:open-godseye', {
          detail: {
            target: {
              target: target || 'OSINT Recon Target',
              name: target || 'OSINT Recon Target',
              lat: targetLat,
              lon: targetLon,
              alt: targetAlt,
              pitch: targetPitch,
              heading: targetHeading,
              category: category,
              address: address,
              formattedAddress: address,
              details: details,
            },
            query: target || undefined,
          },
        })
      );
    }
  };

  const formatAltitude = (meters: number) => {
    if (meters >= 1000000) {
      return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;
    } else if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)}m`;
  };

  return (
    <div className="my-3 rounded-2xl border border-primary/40 bg-background/90 p-3.5 sm:p-4 shadow-[0_0_30px_hsl(var(--primary)/0.2)] font-headline transition-all hover:border-accent">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl border border-primary/50 bg-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_hsl(var(--primary)/0.3)] shrink-0">
            <Globe size={22} className="animate-spin text-accent" style={{ animationDuration: '15s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-accent uppercase">
                GOD&apos;S EYE VIEW // TARGET LOCK
              </span>
              <span className="text-[9px] px-2 py-0.2 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 font-mono flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                OSINT SATELLITE
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground font-mono mt-0.5">
              {target || 'Reconnaissance Coordinates'}
            </h4>
          </div>
        </div>

        <button
          onClick={handleOpenInUI}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-accent/50 bg-accent/25 text-accent font-mono text-xs font-bold hover:bg-accent hover:text-accent-foreground hover:shadow-[0_0_20px_hsl(var(--accent)/0.5)] transition-all cursor-pointer shrink-0"
          title="Open God's Eye 3D Window inside Hermes Agent UI and trace from Earth orbit"
        >
          <Crosshair size={13} />
          <span>TRACE IN GOD&apos;S EYE [🛰️]</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-primary/20 text-xs font-mono">
        <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
          <span className="text-[10px] text-muted-foreground block">COORDINATES</span>
          <span className="text-accent font-bold">
            {targetLat !== 0 || targetLon !== 0 ? `${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}°` : 'GLOBAL ORBIT'}
          </span>
        </div>
        <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
          <span className="text-[10px] text-muted-foreground block">ALTITUDE</span>
          <span className="text-foreground font-bold">{formatAltitude(targetAlt)} AGL</span>
        </div>
        <div className="bg-primary/10 rounded-lg p-2 border border-primary/20 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground block">PLATFORM</span>
          <span className="text-primary font-bold">~/gods-eye-view</span>
        </div>
      </div>

      {address && (
        <p className="mt-2 text-xs font-sans text-muted-foreground truncate">
          📍 {address}
        </p>
      )}

      {details && (
        <p className="mt-1 text-xs font-sans text-foreground/90 leading-relaxed">
          {details}
        </p>
      )}
    </div>
  );
};

export const RichMessageContent: React.FC<RichMessageContentProps> = ({
  content,
  imageUrl,
  isUser = false,
  onExecuteCommand,
}) => {
  // If user message, render clean typography
  if (isUser) {
    return (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed break-words">
          {content}
        </p>
        {imageUrl && (
          <div className="relative mt-2 h-44 w-44 overflow-hidden rounded-xl border border-primary/30 shadow-md">
            <Image src={imageUrl} alt="Uploaded attachment" fill className="object-cover" />
          </div>
        )}
      </div>
    );
  }

  // Parse Assistant Message for:
  // 1. Code blocks (```lang ... ```)
  // 2. Image generation artifacts (![alt](url) or /imagine prompts)
  // 3. Alerts (> [!NOTE])
  // 4. Tables (| ... |)
  // 5. Headings, bullet lists, inline styles
  const elements: React.ReactNode[] = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];

  let inTable = false;
  let tableRows: string[][] = [];

  let inAlert = false;
  let alertType = '';
  let alertBuffer: string[] = [];

  const flushCode = (key: string | number) => {
    if (codeBuffer.length > 0) {
      if (codeLang.toLowerCase() === 'godseye' || codeLang.toLowerCase() === 'osint-geo') {
        elements.push(
          <GodsEyeTargetCard
            key={`godseye-${key}`}
            rawJson={codeBuffer.join('\n')}
          />
        );
      } else {
        elements.push(
          <CodeBlock
            key={`code-${key}`}
            language={codeLang}
            code={codeBuffer.join('\n')}
            onExecuteCommand={onExecuteCommand}
          />
        );
      }
      codeBuffer = [];
      codeLang = '';
    }
  };

  const flushAlert = (key: string | number) => {
    if (alertBuffer.length > 0) {
      elements.push(
        <AlertCallout
          key={`alert-${key}`}
          type={alertType}
          content={alertBuffer.join('\n')}
        />
      );
      alertBuffer = [];
      alertType = '';
    }
  };

  const flushTable = (key: string | number) => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div
          key={`table-${key}`}
          className="my-3 overflow-x-auto rounded-xl border border-primary/30 bg-background/80 shadow-md text-xs font-mono"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-primary/20 bg-primary/10">
                {headers.map((h, i) => (
                  <th key={i} className="p-2.5 text-left font-bold text-accent">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-primary/10 hover:bg-primary/5 transition-colors"
                >
                  {r.map((c, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-foreground/90 font-sans">
                      {c.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code Block Fence (```)
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        inCodeBlock = false;
        flushCode(i);
      } else {
        // Start of code block
        if (inAlert) {
          inAlert = false;
          flushAlert(i);
        }
        if (inTable) {
          inTable = false;
          flushTable(i);
        }
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // 2. Alert Callouts (> [!NOTE])
    if (line.trim().startsWith('> [!')) {
      if (inTable) {
        inTable = false;
        flushTable(i);
      }
      const match = line.match(/>\s*(\[![\w\s]+\])/);
      alertType = match ? match[1] : 'NOTE';
      inAlert = true;
      const rest = line.replace(/>\s*\[![\w\s]+\]/, '').trim();
      if (rest) alertBuffer.push(rest);
      continue;
    }

    if (inAlert) {
      if (line.trim().startsWith('>')) {
        alertBuffer.push(line.replace(/^>\s*/, ''));
        continue;
      } else {
        inAlert = false;
        flushAlert(i);
      }
    }

    // 3. Tables (| ... |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Skip markdown divider line (|---|---|)
      if (/^\|[-:\s|]+\|$/.test(line.trim())) {
        continue;
      }
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|');
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      inTable = false;
      flushTable(i);
    }

    // 4. Markdown Images (![alt](url))
    const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const caption = imageMatch[1];
      const url = imageMatch[2];
      elements.push(
        <ImageArtifactCard key={`img-${i}`} imageUrl={url} caption={caption} />
      );
      continue;
    }

    // 5. Headings (###)
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={`h3-${i}`}
          className="mt-3 mb-1 text-sm font-bold font-mono tracking-wider text-accent border-l-2 border-accent pl-2"
        >
          {line.slice(4)}
        </h3>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={`h2-${i}`}
          className="mt-4 mb-1.5 text-base font-black font-mono tracking-wider text-primary border-l-4 border-primary pl-2.5"
        >
          {line.slice(3)}
        </h2>
      );
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h1
          key={`h1-${i}`}
          className="mt-4 mb-2 text-lg font-black font-mono tracking-widest text-primary [text-shadow:0_0_10px_hsl(var(--primary)/0.4)]"
        >
          {line.slice(2)}
        </h1>
      );
      continue;
    }

    // 6. Bullet lists (- or *)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const itemText = line.trim().slice(2);
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1 text-[13px] text-foreground/90 leading-relaxed pl-1">
          <span className="text-accent shrink-0 mt-1 select-none font-bold">▸</span>
          <span className="flex-1 font-sans">{renderInlineMarkdown(itemText)}</span>
        </div>
      );
      continue;
    }

    // 7. Numbered lists (1. , 2. )
    const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      const num = numMatch[1];
      const itemText = numMatch[2];
      elements.push(
        <div key={`oli-${i}`} className="flex items-start gap-2 my-1 text-[13px] text-foreground/90 leading-relaxed pl-1">
          <span className="font-mono text-[10px] text-accent font-bold px-1 py-0.5 rounded border border-primary/20 bg-primary/10 shrink-0 mt-0.5 select-none">
            {num.padStart(2, '0')}
          </span>
          <span className="flex-1 font-sans">{renderInlineMarkdown(itemText)}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} className="h-2" />);
      continue;
    }

    // Regular paragraphs with inline formatting
    elements.push(
      <p key={`p-${i}`} className="my-1 text-[13px] leading-relaxed text-foreground/95 font-sans break-words">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  if (inCodeBlock) flushCode('final');
  if (inAlert) flushAlert('final');
  if (inTable) flushTable('final');

  // If message has external uploaded image
  if (imageUrl) {
    elements.push(
      <ImageArtifactCard key="ext-img" imageUrl={imageUrl} caption="User Attached Image" />
    );
  }

  return <div className="space-y-1">{elements}</div>;
};

// Helper for inline markdown: bold (**text**), inline code (`code`), links ([text](url))
function renderInlineMarkdown(text: string): React.ReactNode {
  // Regex splitting by bold (**...**), inline code (`...`), or links ([...](...))
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);

  return (
    <>
      {parts.map((part, idx) => {
        // Bold
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-bold text-accent tracking-wide">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Inline Code
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={idx}
              className="mx-1 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent shadow-sm"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        // Links
        const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          return (
            <a
              key={idx}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline font-semibold hover:text-foreground transition-colors mx-0.5"
            >
              {linkMatch[1]}
            </a>
          );
        }

        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

export default RichMessageContent;
