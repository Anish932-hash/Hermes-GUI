import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { HERMES_HOME, execAsync } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configPath = path.join(HERMES_HOME, 'config.yaml');
    const soulPath = path.join(HERMES_HOME, 'SOUL.md');
    const envPath = path.join(HERMES_HOME, '.env');

    let configStr = '';
    if (fs.existsSync(configPath)) {
      configStr = fs.readFileSync(configPath, 'utf8');
    }

    let soulPrompt = '';
    if (fs.existsSync(soulPath)) {
      soulPrompt = fs.readFileSync(soulPath, 'utf8');
    }

    // Parse model & provider
    const modelMatch = configStr.match(/default:\s*['"]?([^'"\n#]+)['"]?/);
    const providerMatch = configStr.match(/provider:\s*['"]?([^'"\n#]+)['"]?/);
    const tempMatch = configStr.match(/temperature:\s*([0-9.]+)/);
    const maxTokensMatch = configStr.match(/max_tokens:\s*([0-9]+)/);
    const streamingMatch = configStr.match(/streaming:\s*(true|false)/i);
    const reasoningMatch = configStr.match(/reasoning:\s*['"]?([^'"\n#]+)['"]?/);
    const maxSessionsMatch = configStr.match(/max_concurrent_sessions:\s*([0-9]+)/);
    const journalModeMatch = configStr.match(/journal_mode:\s*['"]?([^'"\n#]+)['"]?/);

    // Read .env to inspect active API providers
    const envKeys: Record<string, boolean> = {
      openrouter: false,
      nvidia: false,
      tavily: false,
      google: false,
      anthropic: false,
      openai: false,
    };

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envKeys.openrouter = /OPENROUTER_API_KEY\s*=\s*[^\s#]+/.test(envContent);
      envKeys.nvidia = /NVIDIA_API_KEY\s*=\s*[^\s#]+/.test(envContent);
      envKeys.tavily = /TAVILY_API_KEY\s*=\s*[^\s#]+/.test(envContent);
      envKeys.google = /(GOOGLE_API_KEY|GEMINI_API_KEY)\s*=\s*[^\s#]+/.test(envContent);
      envKeys.anthropic = /ANTHROPIC_API_KEY\s*=\s*[^\s#]+/.test(envContent);
      envKeys.openai = /OPENAI_API_KEY\s*=\s*[^\s#]+/.test(envContent);
    }

    return NextResponse.json({
      model: modelMatch ? modelMatch[1].trim() : 'nvidia/nemotron-3-ultra-550b-a55b',
      provider: providerMatch ? providerMatch[1].trim() : 'nvidia',
      temperature: tempMatch ? parseFloat(tempMatch[1]) : 0.7,
      maxTokens: maxTokensMatch ? parseInt(maxTokensMatch[1], 10) : 4096,
      streaming: streamingMatch ? streamingMatch[1].toLowerCase() === 'true' : true,
      reasoning: reasoningMatch ? reasoningMatch[1].trim() : 'on',
      maxSessions: maxSessionsMatch ? parseInt(maxSessionsMatch[1], 10) : 5,
      journalMode: journalModeMatch ? journalModeMatch[1].trim() : 'wal',
      soulPrompt,
      rawYaml: configStr,
      configPath,
      soulPath,
      envKeys,
      availableModels: [
        {
          id: 'nvidia/nemotron-3-ultra-550b-a55b',
          provider: 'nvidia',
          label: 'Nvidia Nemotron-3 550B (Active Default)',
          description: 'Ultra-scale 550B reasoning and cybersecurity instruction-tuned model',
          contextWindow: '64k',
          recommended: true,
        },
        {
          id: 'google/gemini-2.5-flash',
          provider: 'openrouter',
          label: 'Google Gemini 2.5 Flash',
          description: 'Sub-second real-time multimodal intelligence with huge context',
          contextWindow: '1M',
          recommended: false,
        },
        {
          id: 'anthropic/claude-3-7-sonnet',
          provider: 'openrouter',
          label: 'Claude 3.7 Sonnet (Hybrid Thinking)',
          description: 'Advanced reasoning, coding, and autonomous tool use execution',
          contextWindow: '200k',
          recommended: false,
        },
        {
          id: 'openai/gpt-4o',
          provider: 'openrouter',
          label: 'OpenAI GPT-4o',
          description: 'High-throughput multimodal frontier reasoning and agent execution',
          contextWindow: '128k',
          recommended: false,
        },
        {
          id: 'deepseek/deepseek-r1',
          provider: 'openrouter',
          label: 'DeepSeek R1 (Deep Reasoning)',
          description: 'Open-weights chain-of-thought mathematical and logic reasoning',
          contextWindow: '64k',
          recommended: false,
        },
        {
          id: 'meta-llama/llama-3.3-70b-instruct',
          provider: 'openrouter',
          label: 'Llama 3.3 70B Instruct',
          description: 'High performance open frontier architecture for automation tasks',
          contextWindow: '128k',
          recommended: false,
        },
      ],
      availableProviders: [
        { id: 'nvidia', label: 'NVIDIA NIM (build.nvidia.com)', keyConfigured: envKeys.nvidia },
        { id: 'openrouter', label: 'OpenRouter Aggregator', keyConfigured: envKeys.openrouter },
        { id: 'gemini', label: 'Google AI Studio Direct', keyConfigured: envKeys.google },
        { id: 'anthropic', label: 'Anthropic Claude API', keyConfigured: envKeys.anthropic },
        { id: 'openai-codex', label: 'OpenAI Direct', keyConfigured: envKeys.openai },
        { id: 'auto', label: 'Auto-Detect from Credentials', keyConfigured: true },
      ],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const configPath = path.join(HERMES_HOME, 'config.yaml');
    const soulPath = path.join(HERMES_HOME, 'SOUL.md');

    // 1. Direct raw YAML update
    if (typeof body.rawYaml === 'string') {
      if (fs.existsSync(configPath)) {
        // Backup previous config
        fs.copyFileSync(configPath, `${configPath}.bak`);
      }
      fs.writeFileSync(configPath, body.rawYaml, 'utf8');
      return NextResponse.json({
        success: true,
        message: 'Successfully saved raw config.yaml (backup created)',
      });
    }

    // 2. SOUL prompt update
    if (typeof body.soulPrompt === 'string') {
      fs.writeFileSync(soulPath, body.soulPrompt, 'utf8');
      return NextResponse.json({
        success: true,
        message: 'Successfully updated Hermes SOUL.md system personality instructions',
      });
    }

    // 3. Structured settings update
    if (fs.existsSync(configPath)) {
      let content = fs.readFileSync(configPath, 'utf8');

      if (body.model) {
        if (/default:\s*['"]?[^'"\n#]+['"]?/.test(content)) {
          content = content.replace(/default:\s*['"]?[^'"\n#]+['"]?/, `default: '${body.model}'`);
        }
      }

      if (body.provider) {
        if (/provider:\s*['"]?[^'"\n#]+['"]?/.test(content)) {
          content = content.replace(/provider:\s*['"]?[^'"\n#]+['"]?/, `provider: '${body.provider}'`);
        }
      }

      if (typeof body.temperature === 'number') {
        if (/temperature:\s*[0-9.]+/.test(content)) {
          content = content.replace(/temperature:\s*[0-9.]+/, `temperature: ${body.temperature}`);
        } else {
          // append under model section if missing
          content = content.replace(/model:\n/, `model:\n  temperature: ${body.temperature}\n`);
        }
      }

      if (typeof body.maxTokens === 'number') {
        if (/max_tokens:\s*[0-9]+/.test(content)) {
          content = content.replace(/max_tokens:\s*[0-9]+/, `max_tokens: ${body.maxTokens}`);
        }
      }

      if (typeof body.streaming === 'boolean') {
        if (/streaming:\s*(true|false)/i.test(content)) {
          content = content.replace(/streaming:\s*(true|false)/i, `streaming: ${body.streaming}`);
        }
      }

      if (body.reasoning) {
        if (/reasoning:\s*['"]?[^'"\n#]+['"]?/.test(content)) {
          content = content.replace(/reasoning:\s*['"]?[^'"\n#]+['"]?/, `reasoning: '${body.reasoning}'`);
        }
      }

      if (typeof body.maxSessions === 'number') {
        if (/max_concurrent_sessions:\s*[0-9]+/.test(content)) {
          content = content.replace(/max_concurrent_sessions:\s*[0-9]+/, `max_concurrent_sessions: ${body.maxSessions}`);
        }
      }

      fs.copyFileSync(configPath, `${configPath}.bak`);
      fs.writeFileSync(configPath, content, 'utf8');
    }

    // Also update SOUL.md if passed alongside structured settings
    if (typeof body.soulPrompt === 'string') {
      fs.writeFileSync(soulPath, body.soulPrompt, 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: 'Hermes configurations saved and applied to ~/.hermes/config.yaml',
      updated: body,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
