import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

interface RunWithOverrideRequest {
  projectId: string;
  specFile: string;
  spId: string;
  overrides: Record<string, string>;
  keepOverrides?: Record<string, boolean>;
}

interface ExecutionAttempt {
  id: string;
  timestamp: string;
  spId: string;
  specFile: string;
  overrides: Record<string, string>;
  status: 'running' | 'complete' | 'error';
  response?: string;
  error?: string;
}

function getProject(projectId: string) {
  const projectPath = path.resolve('data', 'projects', `${projectId}.json`);
  if (!existsSync(projectPath)) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const content = readFileSync(projectPath, 'utf-8');
  return JSON.parse(content) as {
    id: string;
    name: string;
    specDir: string;
    logsDir: string;
    constraints?: string[];
    context?: string;
  };
}

function buildPromptForSp(
  specContent: string,
  spId: string,
  projectContext: string,
  constraints: string[]
): string {
  const spIdUpper = spId.toUpperCase();

  const spHeaderRegex = new RegExp(
    `(###\\s+${spIdUpper}[:\\s][^\\n]*)([\\s\\S]*?)(?=###\\s+SP-\\d+|$)`,
    'i'
  );
  const match = specContent.match(spHeaderRegex);
  const spBody = match ? match[0].trim() : specContent;

  const constraintsSection =
    constraints.length > 0
      ? `\n\n## Project Constraints\n${constraints.map((c) => `- ${c}`).join('\n')}`
      : '';

  const contextSection = projectContext
    ? `\n\n## Project Context\n${projectContext}`
    : '';

  return `You are an AI assistant implementing a spec-driven development lifecycle.

## Full Spec
${specContent}
${contextSection}
${constraintsSection}

## Your Task
Implement the following sub-prompt: ${spIdUpper}

${spBody}

Respond with a JSON object containing:
- files: array of { path: string, content: string }
- commands: array of shell commands to run
- notes: any implementation notes

Ensure all TypeScript is strict-mode compatible. Never use hardcoded paths.`;
}

function logAttempt(logsDir: string, attempt: ExecutionAttempt): void {
  const logsPath = path.resolve(logsDir);
  if (!existsSync(logsPath)) {
    mkdirSync(logsPath, { recursive: true });
  }

  const logFile = path.resolve(
    logsPath,
    `${attempt.spId}-${attempt.id}.json`
  );
  writeFileSync(logFile, JSON.stringify(attempt, null, 2), 'utf-8');
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: RunWithOverrideRequest;

  try {
    body = (await request.json()) as RunWithOverrideRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { projectId, specFile, spId, overrides, keepOverrides = {} } = body;

  if (!projectId || !specFile || !spId) {
    return NextResponse.json(
      { error: 'projectId, specFile, and spId are required' },
      { status: 400 }
    );
  }

  let project: ReturnType<typeof getProject>;
  try {
    project = getProject(projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Project not found';
    return NextResponse.json({ error: message }, { status: 404 });
  }

  const specPath = path.resolve(project.specDir, specFile);
  if (!existsSync(specPath)) {
    return NextResponse.json(
      { error: `Spec file not found: ${specFile}` },
      { status: 404 }
    );
  }

  const specContent = readFileSync(specPath, 'utf-8');
  const overrideText = overrides[spId] ?? '';
  const keepThisOverride = keepOverrides[spId] ?? false;

  const basePrompt = buildPromptForSp(
    specContent,
    spId,
    project.context ?? '',
    project.constraints ?? []
  );

  const fullPrompt = overrideText.trim()
    ? `${basePrompt}\n\n## Additional Instructions (one-time)\n${overrideText.trim()}`
    : basePrompt;

  const attemptId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();

  const attempt: ExecutionAttempt = {
    id: attemptId,
    timestamp,
    spId,
    specFile,
    overrides: overrideText.trim() ? { [spId]: overrideText } : {},
    status: 'running',
  };

  logAttempt(project.logsDir, attempt);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown): void => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      sendEvent('start', {
        attemptId,
        spId,
        hasOverride: overrideText.trim().length > 0,
        keepOverride: keepThisOverride,
        timestamp,
      });

      try {
        let fullResponse = '';

        const anthropicStream = await client.messages.stream({
          model: 'claude-opus-4-5',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: fullPrompt,
            },
          ],
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            sendEvent('chunk', { text });
          }
        }

        const finalMessage = await anthropicStream.finalMessage();
        const inputTokens = finalMessage.usage?.input_tokens ?? 0;
        const outputTokens = finalMessage.usage?.output_tokens ?? 0;

        attempt.status = 'complete';
        attempt.response = fullResponse;
        logAttempt(project.logsDir, attempt);

        let parsedFiles: Array<{ path: string; content: string }> = [];
        let parsedCommands: string[] = [];
        let parsedNotes = '';

        try {
          const jsonMatch = fullResponse.match(/```json\n?([\s\S]*?)\n?```/);
          const jsonStr = jsonMatch ? jsonMatch[1] : fullResponse;
          const parsed = JSON.parse(jsonStr) as {
            files?: Array<{ path: string; content: string }>;
            commands?: string[];
            notes?: string;
          };
          parsedFiles = parsed.files ?? [];
          parsedCommands = parsed.commands ?? [];
          parsedNotes = parsed.notes ?? '';
        } catch {
          // Response may not be JSON — send raw
        }

        sendEvent('complete', {
          attemptId,
          spId,
          files: parsedFiles,
          commands: parsedCommands,
          notes: parsedNotes,
          rawResponse: fullResponse,
          usage: { inputTokens, outputTokens },
          overrideApplied: overrideText.trim().length > 0,
          overrideKept: keepThisOverride,
          overrideText: overrideText.trim().length > 0 ? overrideText : null,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Execution failed';

        attempt.status = 'error';
        attempt.error = message;
        logAttempt(project.logsDir, attempt);

        sendEvent('error', { message, attemptId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}