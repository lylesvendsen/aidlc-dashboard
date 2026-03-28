import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { promises as fs } from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  projectId: string;
  messages: Message[];
  mode: 'scratch' | 'review' | 'failure';
  existingSpec?: string;
  logId?: string;
}

interface Project {
  id: string;
  name: string;
  stack?: string;
  projectContext?: string;
  constraints?: string[];
  specDir: string;
  logsDir: string;
  model?: string;
}

const SPEC_TEMPLATE = `# [SPEC-ID] - [Title]
# Version: 1.0
# Part of: [Project Name] AIDLC
# Updated: [Month Year]

## What this unit delivers
[One paragraph describing what this unit produces. Be concrete about outputs.]

## Context
[List prerequisites. Which units must be complete before this one. What environment requirements exist.]

## Architecture principles
[List the key architectural decisions and constraints that apply to this unit specifically.]

## Sub-prompts (execute in order)

### SP-01: [Sub-prompt title]
[Description of what this sub-prompt does]

Files to create:
  path/to/file.ts

Files to modify:
  path/to/existing/file.ts  (describe what changes)

[Implementation details and requirements]

Acceptance:
  SP01-01  [Criterion that can be verified automatically]
  SP01-02  [Another verifiable criterion]

### SP-02: [Next sub-prompt title]
[Continue pattern...]

## Done when
[Summary of all acceptance criteria. When all pass, the unit is complete.]

## Files produced by this unit
  path/to/created/file.ts
  path/to/another/file.ts

## Next unit
[Next spec ID and title]`;

async function loadProject(projectId: string): Promise<Project | null> {
  try {
    const projectPath = path.resolve('data', 'projects', `${projectId}.json`);
    const raw = await fs.readFile(projectPath, 'utf-8');
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

async function listExistingSpecs(specDir: string): Promise<{ id: string; title: string }[]> {
  try {
    const resolvedDir = path.resolve(specDir);
    const files = await fs.readdir(resolvedDir);
    const specs: { id: string; title: string }[] = [];

    for (const file of files) {
      if (!file.endsWith('.md') || file.startsWith('.')) continue;
      try {
        const content = await fs.readFile(path.resolve(resolvedDir, file), 'utf-8');
        const firstLine = content.split('\n')[0] ?? '';
        const match = firstLine.match(/^#\s+([A-Z0-9]+-[A-Za-z0-9-]+)\s+-\s+(.+)$/);
        if (match && match[1] && match[2]) {
          specs.push({ id: match[1].trim(), title: match[2].trim() });
        } else {
          const nameWithoutExt = file.replace(/\.md$/, '');
          specs.push({ id: nameWithoutExt, title: nameWithoutExt });
        }
      } catch {
        // skip unreadable files
      }
    }

    return specs;
  } catch {
    return [];
  }
}

function buildSystemPrompt(
  project: Project,
  existingSpecs: { id: string; title: string }[],
  mode: 'scratch' | 'review' | 'failure',
  existingSpec?: string,
  logId?: string,
): string {
  const specList =
    existingSpecs.length > 0
      ? existingSpecs.map((s) => `  - ${s.id}: ${s.title}`).join('\n')
      : '  (no existing specs yet)';

  const constraintsList =
    project.constraints && project.constraints.length > 0
      ? project.constraints.map((c) => `  - ${c}`).join('\n')
      : '  (no additional constraints specified)';

  let modeInstructions = '';

  if (mode === 'scratch') {
    modeInstructions = `## Your task: Build from Scratch
You are helping the engineer build a new spec from scratch through conversation.

Start by asking clarifying questions. Do NOT generate a spec until you have enough information.
Ask these questions (not all at once — have a natural conversation):
1. What does this feature do for the user? What problem does it solve?
2. Which existing units does it depend on? (refer to the existing spec IDs listed above)
3. What are the edge cases and failure modes to handle?
4. How will we know it works? What would a passing acceptance test look like?

Once you have gathered enough information (usually after 3-5 exchanges), generate a complete spec
following the SPEC-TEMPLATE exactly. Choose an appropriate spec ID that does not conflict with
the existing spec IDs listed above.

When you generate or update the spec, output it in a clearly delimited block like this:

<SPEC>
[full spec markdown here]
</SPEC>

You can update the spec multiple times as the conversation evolves. The latest <SPEC> block
will be shown in the preview.`;
  } else if (mode === 'review') {
    modeInstructions = `## Your task: Review Existing Spec
You are reviewing an existing spec to identify improvements.
${existingSpec ? `\nThe spec to review has been provided in the conversation context.` : ''}

Analyse the spec and identify:
1. **Acceptance criteria that are not automatically testable** — criteria that say "looks good" or 
   require human judgment without a clear pass/fail check.
2. **Sub-prompts that are too large** — any sub-prompt with more than 5 files to create/modify 
   or more than 5 acceptance criteria. Suggest how to split them.
3. **Missing file paths** — build instructions that describe behaviour but don't specify which 
   files to create or modify.
4. **Architectural violations** — anything that conflicts with the project's architecture principles.
5. **Missing constraints** — constraints specific to this feature that should be documented.

Provide your analysis conversationally. When you have a revised version of the spec ready,
output it in a clearly delimited block like this:

<SPEC>
[full revised spec markdown here]
</SPEC>`;
  } else if (mode === 'failure') {
    modeInstructions = `## Your task: Learn from Failure
You are analysing a failed execution to improve the spec.
${logId ? `\nLog ID: ${logId}` : ''}
${existingSpec ? `\nThe execution log and/or spec have been provided in the conversation context.` : ''}

Read the provided execution log carefully and:
1. **Identify failure patterns** — what went wrong, and why? Is it a spec ambiguity, missing
   constraint, or architectural gap?
2. **Suggest new acceptance criteria** — criteria that would have caught the failure earlier
   in the development cycle.
3. **Suggest new constraints** — constraints that would prevent this failure pattern in future.
4. **Identify sub-prompts to split or clarify** — were any sub-prompts too vague or too large?
5. **Identify missing file paths** — were there files the AI needed to know about but weren't
   listed in the spec?

Provide your analysis conversationally, then when you have an improved spec ready, output it:

<SPEC>
[full improved spec markdown here]
</SPEC>`;
  }

  return `You are an expert AIDLC (AI-Driven Development Lifecycle) spec author.
You help engineers write precise, executable specs that AI coding assistants can implement reliably.

## Project Context
Project name: ${project.name}
Project ID: ${project.id}
Stack: ${project.stack ?? 'Not specified'}
Model: ${project.model ?? 'default'}

Project description / context:
${project.projectContext ?? '(no project context provided)'}

## Project Constraints
${constraintsList}

## Existing Spec IDs (do not reuse these IDs)
${specList}

## SPEC-TEMPLATE Structure
Every spec must follow this exact structure:

${SPEC_TEMPLATE}

## Key rules for good specs
- Every acceptance criterion must be automatically verifiable (no "looks good" criteria)
- Sub-prompts should be focused: max ~5 files, max ~5 acceptance criteria each
- Every file mentioned in the spec must have its full path from the app root
- Constraints section must be explicit and project-specific
- "Done when" section summarises all acceptance criteria
- Mode-specific instructions override general behaviour

${modeInstructions}`;
}

function encodeSSE(data: Record<string, string>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { projectId, messages, mode, existingSpec, logId } = body;

  if (!projectId || !messages || !mode) {
    return new Response(JSON.stringify({ error: 'Missing required fields: projectId, messages, mode' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!['scratch', 'review', 'failure'].includes(mode)) {
    return new Response(JSON.stringify({ error: 'Invalid mode. Must be scratch, review, or failure' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const project = await loadProject(projectId);
  if (!project) {
    return new Response(JSON.stringify({ error: `Project not found: ${projectId}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const existingSpecs = await listExistingSpecs(project.specDir);
  const systemPrompt = buildSystemPrompt(project, existingSpecs, mode, existingSpec, logId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const streamResponse = await anthropic.messages.stream({
          model: project.model ?? 'claude-opus-4-5',
          max_tokens: 8192,
          system: systemPrompt,
          messages: anthropicMessages,
        });

        let fullText = '';

        for await (const chunk of streamResponse) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const deltaText = chunk.delta.text;
            fullText += deltaText;

            // Check if we can extract a spec block from what we have so far
            // We emit text chunks continuously, and spec chunks when we detect complete/partial spec blocks
            const specStartIdx = fullText.indexOf('<SPEC>');
            const specEndIdx = fullText.indexOf('</SPEC>');

            if (specStartIdx !== -1 && specEndIdx !== -1 && specEndIdx > specStartIdx) {
              // We have a complete spec block — extract the spec content
              const specContent = fullText.slice(specStartIdx + 6, specEndIdx).trim();

              // Emit text content before the spec block
              const textBefore = fullText.slice(0, specStartIdx).trim();
              if (textBefore) {
                controller.enqueue(
                  encoder.encode(encodeSSE({ type: 'text', content: deltaText })),
                );
              }

              // Emit the spec block as a spec chunk
              controller.enqueue(
                encoder.encode(encodeSSE({ type: 'spec', content: specContent })),
              );

              // Reset fullText to only what comes after the spec block
              fullText = fullText.slice(specEndIdx + 7);
            } else if (specStartIdx === -1) {
              // No spec block started yet — emit as text
              controller.enqueue(
                encoder.encode(encodeSSE({ type: 'text', content: deltaText })),
              );
            } else {
              // Spec block started but not yet closed — buffer it, emit non-spec prefix as text
              // Only emit text for content before the opening tag that hasn't been emitted yet
              // We track this by only emitting if the deltaText doesn't overlap with the spec start
              const textBeforeSpec = fullText.slice(0, specStartIdx);
              // We only emit text that is new (after the previously buffered amount)
              // Simple approach: if delta is entirely before spec start, emit it
              const prevLength = fullText.length - deltaText.length;
              const prevSpecStart = fullText.slice(0, prevLength).indexOf('<SPEC>');
              if (prevSpecStart === -1 && specStartIdx >= prevLength) {
                // The spec tag appeared in this delta chunk — emit text before the spec tag
                const textPortionInDelta = deltaText.slice(0, specStartIdx - prevLength);
                if (textPortionInDelta) {
                  controller.enqueue(
                    encoder.encode(encodeSSE({ type: 'text', content: textPortionInDelta })),
                  );
                }
              } else if (prevSpecStart === -1) {
                // Entirely before spec — emit
                controller.enqueue(
                  encoder.encode(encodeSSE({ type: 'text', content: deltaText })),
                );
              }
              // else: we're inside the spec block — buffer, don't emit
              void textBeforeSpec; // suppress unused warning
            }
          }
        }

        // After streaming ends, emit any remaining text (after last spec block)
        if (fullText.trim()) {
          // Check one more time for any unclosed spec block
          const finalSpecStart = fullText.indexOf('<SPEC>');
          if (finalSpecStart === -1) {
            controller.enqueue(
              encoder.encode(encodeSSE({ type: 'text', content: fullText })),
            );
          } else {
            // Partial spec block — emit what came before it as text
            const textBefore = fullText.slice(0, finalSpecStart).trim();
            if (textBefore) {
              controller.enqueue(
                encoder.encode(encodeSSE({ type: 'text', content: textBefore })),
              );
            }
            // The partial spec content we drop (incomplete)
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Streaming error';
        controller.enqueue(
          encoder.encode(encodeSSE({ type: 'text', content: `Error: ${message}` })),
        );
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
