'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Shield, User, Copy, Check, Volume2, VolumeX, Sparkles, Zap, Activity, Cpu, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { soundFx } from '@/lib/audio-synth';
import RichMessageContent from './rich-message-content';

export interface TaskMeta {
  title: string;
  protocol: string;
  command?: string;
  status: 'RUNNING' | 'SUCCESS' | 'ERROR';
  exitCode?: string;
  realOutput?: string;
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  imageUrl?: string;
  id: string;
  taskMeta?: TaskMeta;
}

interface ChatMessageProps {
  message: Message;
  onExecuteCommand?: (cmd: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onExecuteCommand }) => {
  const isUser = message.role === 'user';
  const isThinking = message.role === 'model' && message.content === '' && !message.imageUrl && !message.taskMeta;
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    soundFx.playClick(1100);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      soundFx.stopSpeechTelemetry();
      setIsSpeaking(false);
      return;
    }

    soundFx.playClick(950);
    setIsSpeaking(true);
    soundFx.speakText(message.content, () => {
      setIsSpeaking(false);
    });
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3.5 animate-fade-in group w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Hermes Assistant Avatar */}
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/60 shadow-[0_0_12px_hsl(var(--primary)/0.3)] bg-primary/10 shrink-0 mt-1">
          <AvatarFallback className="bg-background text-primary">
            <Shield size={16} className="text-accent" />
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Bubble Container */}
      <div
        className={cn(
          'relative rounded-2xl p-3.5 sm:p-4 text-sm backdrop-blur-md shadow-lg transition-all',
          isUser
            ? 'max-w-md sm:max-w-lg rounded-br-none border border-primary/40 bg-primary/15 text-foreground'
            : 'w-full max-w-xl lg:max-w-2xl rounded-bl-none border border-primary/25 bg-background/80 text-foreground/95 shadow-[0_0_25px_hsl(var(--primary)/0.08)]'
        )}
      >
        {/* Model Message Header: Title, Vocalize & Copy */}
        {!isUser && !isThinking && (
          <div className="flex items-center justify-between border-b border-primary/20 pb-1.5 mb-2.5 text-[10px] text-primary/80 font-mono tracking-wider">
            <span className="font-bold flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>HERMES AGENT // WSL CORE</span>
            </span>

            <div className="flex items-center gap-2">
              {/* Voice Vocalize Button */}
              <button
                type="button"
                onClick={handleToggleSpeak}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer border',
                  isSpeaking
                    ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400 font-bold shadow-[0_0_8px_hsl(var(--emerald-400)/0.4)] animate-pulse'
                    : 'border-primary/20 text-muted-foreground hover:text-accent hover:border-primary/40'
                )}
                title={isSpeaking ? 'Stop Hermes Speech' : 'Listen to Hermes Voice'}
              >
                {isSpeaking ? (
                  <>
                    <VolumeX size={11} className="text-emerald-400" />
                    <span>STOP</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={11} />
                    <span>SPEAK</span>
                  </>
                )}
              </button>

              {/* Copy Message Text */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/20 text-muted-foreground hover:text-accent hover:border-primary/40 transition-colors cursor-pointer"
                title="Copy message text"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Thinking State */}
        {isThinking ? (
          <div className="flex items-center gap-2.5 text-primary/90 p-2 font-mono">
            <div className="h-2.5 w-2.5 animate-ping rounded-full bg-accent" />
            <span className="text-xs tracking-widest text-accent animate-pulse font-bold flex items-center gap-1.5">
              <Sparkles size={13} className="animate-spin-slow" />
              <span>HERMES INFERENCE RUNNING IN WSL...</span>
            </span>
          </div>
        ) : (
          <>
            {/* Marvel J.A.R.V.I.S. Task Execution HUD Card */}
            {message.taskMeta && (
              <div className="mb-3 rounded-xl border border-accent/40 bg-accent/5 p-3 backdrop-blur-md shadow-[0_0_15px_hsl(var(--accent)/0.15)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/20 pb-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent shrink-0">
                      <Zap size={14} className="text-accent animate-pulse" />
                    </span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-accent uppercase block truncate">
                        {message.taskMeta.protocol}
                      </span>
                      <span className="text-xs font-bold text-foreground truncate block font-sans">
                        {message.taskMeta.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'text-[9px] font-mono px-2 py-0.5 rounded border uppercase font-bold',
                        message.taskMeta.status === 'SUCCESS'
                          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                          : message.taskMeta.status === 'RUNNING'
                          ? 'border-accent/50 bg-accent/15 text-accent animate-pulse'
                          : 'border-destructive/50 bg-destructive/15 text-destructive'
                      )}
                    >
                      {message.taskMeta.status === 'SUCCESS' ? '✓ 200 OK' : message.taskMeta.status}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        soundFx.playClick(1100);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('hermes:open-task-execution', {
                              detail: {
                                title: message.taskMeta?.title,
                                protocol: message.taskMeta?.protocol,
                                command: message.taskMeta?.command,
                                isCompleted: message.taskMeta?.status === 'SUCCESS',
                                realOutput: message.taskMeta?.realOutput || message.content,
                              },
                            })
                          );
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-mono font-bold text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer shadow-[0_0_10px_hsl(var(--primary)/0.2)]"
                      title="Open live J.A.R.V.I.S. Task Execution HUD"
                    >
                      <Activity size={12} className="text-accent" />
                      <span>VIEW EXECUTION</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>HOST: WSL2 KALI</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Cpu size={11} className="text-primary" />
                    <span>RUNTIME: uv Python 3.14</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Terminal size={11} className="text-accent" />
                    <span>DAEMON: PID 358</span>
                  </span>
                </div>

                {message.taskMeta.status === 'RUNNING' && !message.content && (
                  <div className="flex items-center gap-2 pt-2 border-t border-primary/10 mt-2 text-[11px] font-mono text-accent">
                    <span className="h-2 w-2 rounded-full bg-accent animate-ping" />
                    <span className="animate-pulse">Active tool execution in progress. Streaming WSL2 telemetry...</span>
                  </div>
                )}
              </div>
            )}

            {/* Rich Message Content Renderer */}
            <RichMessageContent
              content={message.content}
              imageUrl={message.imageUrl}
              isUser={isUser}
              onExecuteCommand={onExecuteCommand}
            />
          </>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <Avatar className="h-8 w-8 border border-accent/50 shadow-md shadow-accent/20 bg-accent/10 shrink-0 mt-1">
          <AvatarFallback className="bg-background text-accent">
            <User size={16} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
