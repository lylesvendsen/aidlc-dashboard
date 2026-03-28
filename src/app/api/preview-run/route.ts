import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

interface PendingFile {
  path: string;
  newContent: string;
  existingContent: string;
}

interface PendingResponse {
  executionId: string;
  files: PendingFile[];
  createdAt: number;
}

// Server-side session map for pending responses
const pendingResponses = new Map<string, PendingResponse>();

function generateExecutionId(): string {
  return `prev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readProjectConfig(projectId: string): {
  specDir: string;
  logsDir: string;
  name: string;
} {
  const dataDir = path.resolve(process.cwd(), 'data', 'projects');
  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.resolve(dataDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const proj = JSON.parse(raw) as {
      id: string;
      name: string;
      specDir: string;
      logsDir: string;
    };
    if (proj.id === projectId) {
      return { specDir: proj.specDir, logsDir: proj.logsDir, name: proj.name };
    }
  }
  throw new Error(`Project not found: ${projectId}`);
}

function readSpecFile(specDir: string, specFile: string): string {
  const specPath = path.resolve(specDir, specFile);
  if (!fs.existsSync(specPath)) {
    throw new Error(`Spec file not found: ${specPath}`);
  }
  return fs.readFileSync(specPath, 'utf-8');
}

function extractSubPrompt(specContent: string, spId: string): string {
  const lines = specContent.split('\n');
  const headerPattern = new RegExp(`###\\s+${spId}[:\\s]`, 'i');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) {
    throw new Error(`Sub-prompt ${spId} not found in spec file`);
  }
  const result: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (i !== startIdx && /^###\s+/.test(lines[i])) break;
    result.push(lines[i]);
  }
  return result.join('\n');
}

function getExistingContent(filePath: string): string {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return '';
  try {
    return fs.readFileSync(resolved, 'utf-8');
  } catch {
    return '';
  }
}

function buildPrompt(
  specContent: string,
  spId: string,
  spBody: string,
  overrideText?: string
): string {
  const parts: string[] = [];

  parts.push(`You are an expert software engineer implementing a specification-driven project.`);
  parts.push(`\n## Full Specification\n\n${specContent}`);
  parts.push(`\n## Current Sub-Prompt: ${spId}\n\n${spBody}`);
  parts.push(`\n## Instructions\nImplement the files described in the sub-prompt above. For each file you create or modify, output the file path and complete content using this exact format:\n\n<file path="relative/path/to/file">\n[complete file content]\n</file>\n\nDo not include any explanation outside the file tags. Output every file completely — never truncate.`);

  if (overrideText) {
    parts.push(`\n## Additional Instructions for This Run\n\n${overrideText}`);
  }

  return parts.join('\n');
}

interface ParsedFile {
  path: string;
  content: string;
}

function parseFilesFromResponse(response: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const fileRegex = /<file\s+path="([^"]+)">([\s\S]*?)<\/file>/g;
  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(response)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2],
    });
  }
  return files;
}

// Clean up entries older than 30 minutes
function cleanupOldPending(): void {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [key, value] of pendingResponses.entries()) {
    if (value.createdAt < cutoff) {
      pendingResponses.delete(key);
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      projectId: string;
      specFile: string;
      spId: string;
      overrides?: Record<string, string>;
    };

    const { projectId, specFile, spId, overrides } = body;

    if (!projectId || !specFile || !spId) {
      return NextResponse.json(
        { error: 'projectId, specFile, and spId are required' },
        { status: 400 }
      );
    }

    const { specDir } = readProjectConfig(projectId);
    const specContent = readSpecFile(specDir, specFile);
    const spBody = extractSubPrompt(specContent, spId);
    const overrideText = overrides?.[spId];

    const prompt = buildPrompt(specContent, spId, spBody, overrideText);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    const parsedFiles = parseFilesFromResponse(responseText);

    const pendingFiles: PendingFile[] = parsedFiles.map((f) => ({
      path: f.path,
      newContent: f.content,
      existingContent: getExistingContent(f.path),
    }));

    const executionId = generateExecutionId();

    cleanupOldPending();

    pendingResponses.set(executionId, {
      executionId,
      files: pendingFiles,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      executionId,
      files: pendingFiles,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const executionId = searchParams.get('executionId');

  if (!executionId) {
    return NextResponse.json(
      { error: 'executionId query param required' },
      { status: 400 }
    );
  }

  const pending = pendingResponses.get(executionId);
  if (!pending) {
    return NextResponse.json(
      { error: 'No pending response found for this executionId' },
      { status: 404 }
    );
  }

  return NextResponse.json(pending);
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const executionId = searchParams.get('executionId');

  if (!executionId) {
    return NextResponse.json(
      { error: 'executionId query param required' },
      { status: 400 }
    );
  }

  pendingResponses.delete(executionId);

  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as {
      executionId: string;
      selectedFiles: Array<{ path: string; newContent: string }>;
    };

    const { executionId, selectedFiles } = body;

    if (!executionId || !Array.isArray(selectedFiles)) {
      return NextResponse.json(
        { error: 'executionId and selectedFiles are required' },
        { status: 400 }
      );
    }

    const pending = pendingResponses.get(executionId);
    if (!pending) {
      return NextResponse.json(
        { error: 'No pending response found for this executionId' },
        { status: 404 }
      );
    }

    const written: string[] = [];
    const errors: Array<{ path: string; error: string }> = [];

    for (const file of selectedFiles) {
      try {
        const resolved = path.resolve(file.path);
        const dir = path.dirname(resolved);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolved, file.newContent, 'utf-8');
        written.push(file.path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({ path: file.path, error: message });
      }
    }

    pendingResponses.delete(executionId);

    return NextResponse.json({ written, errors });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}