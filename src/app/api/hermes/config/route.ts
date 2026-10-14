import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { HERMES_HOME } from '@/lib/hermes';
import { isLocalRequest } from '@/lib/local-request';
import { authorizeAction } from '@/lib/action-policy';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

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
  } catch {
    return NextResponse.json({ error: 'The requested Hermes operation failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isLocalRequest(req)) {
    return NextResponse.json({ error: 'Local requests only' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required' }, { status: 400 });
    }
    if (typeof body.rawYaml === 'string' && body.rawYaml.length > 256 * 1024) {
      return NextResponse.json({ error: 'Raw configuration exceeds the 256 KB limit' }, { status: 413 });
    }
    if (typeof body.soulPrompt === 'string' && body.soulPrompt.length > 64 * 1024) {
      return NextResponse.json({ error: 'SOUL prompt exceeds the 64 KB limit' }, { status: 413 });
    }
    const validScalar = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max && ![...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
    if (body.model !== undefined && !validScalar(body.model, 160)) {
      return NextResponse.json({ error: 'Invalid model identifier' }, { status: 400 });
    }
    if (body.provider !== undefined && (!validScalar(body.provider, 64) || !/^[a-zA-Z0-9._-]+$/.test(body.provider))) {
      return NextResponse.json({ error: 'Invalid provider identifier' }, { status: 400 });
    }
    if (body.reasoning !== undefined && !['on', 'off', 'auto'].includes(body.reasoning)) {
      return NextResponse.json({ error: 'Reasoning must be on, off, or auto' }, { status: 400 });
    }
    if (body.streaming !== undefined && typeof body.streaming !== 'boolean') {
      return NextResponse.json({ error: 'streaming must be a boolean' }, { status: 400 });
    }
    if (body.temperature !== undefined && (typeof body.temperature !== 'number' || !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) {
      return NextResponse.json({ error: 'Temperature must be between 0 and 2' }, { status: 400 });
    }
    if (body.maxTokens !== undefined && (!Number.isInteger(body.maxTokens) || body.maxTokens < 1 || body.maxTokens > 200000)) {
      return NextResponse.json({ error: 'maxTokens must be an integer from 1 to 200000' }, { status: 400 });
    }
    if (body.maxSessions !== undefined && (!Number.isInteger(body.maxSessions) || body.maxSessions < 1 || body.maxSessions > 100)) {
      return NextResponse.json({ error: 'maxSessions must be an integer from 1 to 100' }, { status: 400 });
    }
    if (body.rawYaml !== undefined && typeof body.rawYaml !== 'string') {
      return NextResponse.json({ error: 'rawYaml must be a string' }, { status: 400 });
    }
    if (body.soulPrompt !== undefined && typeof body.soulPrompt !== 'string') {
      return NextResponse.json({ error: 'soulPrompt must be a string' }, { status: 400 });
    }
    if (typeof body.rawYaml === 'string' && typeof body.soulPrompt === 'string') {
      return NextResponse.json({ error: 'Submit rawYaml or soulPrompt in a separate request' }, { status: 400 });
    }
    const hasRawWrite = typeof body.rawYaml === 'string';
    const hasSoulWrite = typeof body.soulPrompt === 'string';
    const structuredKeys = ['model', 'provider', 'temperature', 'maxTokens', 'streaming', 'reasoning', 'maxSessions'];
    const hasStructuredUpdate = structuredKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
    if (!hasRawWrite && !hasSoulWrite && !hasStructuredUpdate) {
      return NextResponse.json({ error: 'No supported configuration fields were provided' }, { status: 400 });
    }
    if (hasRawWrite || hasSoulWrite) {
      const action = typeof body.rawYaml === 'string' ? 'config.raw-write' : 'config.soul-write';
      const decision = authorizeAction(action, body.confirmation);
      if (!decision.allowed) {
        return NextResponse.json({ error: decision.reason, risk: decision.risk, action }, { status: decision.status });
      }
    }
    const configPath = path.join(HERMES_HOME, 'config.yaml');
    const soulPath = path.join(HERMES_HOME, 'SOUL.md');
    const hadExistingConfig = fs.existsSync(configPath);

    if (!hasRawWrite && !hasSoulWrite && !fs.existsSync(configPath)) {
      return NextResponse.json({ error: 'Hermes config.yaml was not found; no settings were changed' }, { status: 404 });
    }

    // 1. Direct raw YAML update
    if (typeof body.rawYaml === 'string') {
      if (hadExistingConfig) {
        // Backup previous config
        fs.copyFileSync(configPath, `${configPath}.bak`);
      }
      fs.writeFileSync(configPath, body.rawYaml, 'utf8');
      return NextResponse.json({
        success: true,
        message: hadExistingConfig
          ? 'Successfully saved raw config.yaml and created a backup.'
          : 'Successfully created raw config.yaml.',
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

      // Fail before writing if the existing YAML cannot represent a requested
      // structured field; don't claim success for settings silently ignored.
      const requiredPatterns: Array<[string, RegExp]> = [
        ['model', /default:\s*['"]?[^'"\n#]+['"]?/],
        ['provider', /provider:\s*['"]?[^'"\n#]+['"]?/],
        ['maxTokens', /max_tokens:\s*[0-9]+/],
        ['streaming', /streaming:\s*(true|false)/i],
        ['reasoning', /reasoning:\s*['"]?[^'"\n#]+['"]?/],
        ['maxSessions', /max_concurrent_sessions:\s*[0-9]+/],
      ];
      for (const [key, pattern] of requiredPatterns) {
        if (Object.prototype.hasOwnProperty.call(body, key) && !pattern.test(content)) {
          return NextResponse.json({ error: `Cannot update ${key}: its setting is missing from config.yaml` }, { status: 400 });
        }
      }
      if (Object.prototype.hasOwnProperty.call(body, 'temperature') && !/temperature:\s*[0-9.]+/.test(content) && !/model:\n/.test(content)) {
        return NextResponse.json({ error: 'Cannot update temperature: no model section exists in config.yaml' }, { status: 400 });
      }

      if (body.model) {
        if (/default:\s*['"]?[^'"\n#]+['"]?/.test(content)) {
          content = content.replace(/default:\s*['"]?[^'"\n#]+['"]?/, () => `default: '${body.model.replace(/'/g, "''")}'`);
        }
      }

      if (body.provider) {
        if (/provider:\s*['"]?[^'"\n#]+['"]?/.test(content)) {
          content = content.replace(/provider:\s*['"]?[^'"\n#]+['"]?/, () => `provider: '${body.provider.replace(/'/g, "''")}'`);
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
          content = content.replace(/reasoning:\s*['"]?[^'"\n#]+['"]?/, () => `reasoning: '${body.reasoning}'`);
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
      updated: {
        model: body.model,
        provider: body.provider,
        temperature: body.temperature,
        maxTokens: body.maxTokens,
        streaming: body.streaming,
        reasoning: body.reasoning,
        maxSessions: body.maxSessions,
        soulPromptUpdated: typeof body.soulPrompt === 'string',
      },
    });
  } catch {
    return NextResponse.json({ error: 'The requested Hermes operation failed' }, { status: 500 });
  }
}
