import { NextRequest, NextResponse } from 'next/server';
import {
  HERMES_COMMANDS,
  searchHermesCommands,
  getCommandsByCategory,
  type CommandCategory,
} from '@/lib/hermes-commands';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const category = searchParams.get('category') as CommandCategory | 'ALL' | null;

  if (query) {
    const results = searchHermesCommands(query, 50);
    return NextResponse.json({
      total: results.length,
      commands: results,
    });
  }

  if (category) {
    const results = getCommandsByCategory(category);
    return NextResponse.json({
      category,
      total: results.length,
      commands: results,
    });
  }

  return NextResponse.json({
    total: HERMES_COMMANDS.length,
    categories: [
      'Session',
      'Configuration',
      'Tools & Skills',
      'Security & Cyber',
      'Creative',
      'Info & Telemetry',
    ],
    commands: HERMES_COMMANDS,
  });
}
