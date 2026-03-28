import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getProject } from '@/lib/projects';

interface GeneratedPromptRequest {
  projectId: string;
  specFile: string;
  spId: string;
}

interface SubPromptBlock {
  id: string;
  name: string;
  body: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function parseSubPrompts(specContent: string): SubPromptBlock[] {
  const blocks: SubPromptBlock[] = [];
  const lines = specContent.split('\n');
  let currentId: string | null = null;
  let currentName: string | null = null;
  let currentLines: string[] = [];

  const spHeaderRegex = /^###\s+(SP-\d+):\s*(.+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(spHeaderRegex);

    if (match) {
      if (currentId && currentName !== null) {
        blocks.push({
          id: currentId,
          name: currentName,
          body: currentLines.join('\n').trim(),
        });
      }
      currentId = match[1].toUpperCase();
      currentName = match[2].trim();
      currentLines = [];
    } else if (currentId !== null) {
      currentLines.push(line);
    }
  }

  if (currentId && currentName !== null) {
    blocks.push({
      id: currentId,
      name: currentName,
      body: currentLines.join('\n').trim(),
    });
  }

  return blocks;
}

function extractSpecPreamble(specContent: string): string {
  const lines = specContent.split('\n');
  const preambleLines: string[] = [];

  for (const line of lines) {
    if (/^###\s+SP-\d+:/i.test(line)) {
      break;
    }
    preambleLines.push(line);
  }

  return preambleLines.join('\n').trim();
}

function buildPrompt(
  projectName: string,
  projectDescription: string,
  specPreamble: string,
  spBlock: SubPromptBlock,
  allSpIds: string[]
): string {
  const sections: string[] = [];

  sections.push(`# AIDLC Dashboard — AI Execution Context`);
  sections.push('');

  sections.push(`## Project`);
  sections.push(`Name: ${projectName}`);
  if (projectDescription) {
    sections.push(`Description: ${projectDescription}`);
  }
  sections.push('');

  sections.push(`## Spec Overview`);
  sections.push(specPreamble);
  sections.push('');

  if (allSpIds.length > 1) {
    sections.push(`## All Sub-Prompts in This Spec`);
    sections.push(allSpIds.join(', '));
    sections.push('');
  }

  sections.push(`## Constraints`);
  sections.push(`- TypeScript strict mode throughout`);
  sections.push(`- Next.js 15 with React 19`);
  sections.push(`- Tailwind CSS for all styling — no hardcoded colors or inline styles`);
  sections.push(`- Zustand for client state management`);
  sections.push(`- Filesystem-based storage — no database`);
  sections.push(`- API routes must use async params pattern for Next.js 15`);
  sections.push(`- Never import unused variables, types, or modules`);
  sections.push(`- Never hardcode file paths — always use path.resolve()`);
  sections.push(`- All new files must be complete — no placeholders or TODOs`);
  sections.push('');

  sections.push(`## Target Sub-Prompt: ${spBlock.id}`);
  sections.push(`### ${spBlock.id}: ${spBlock.name}`);
  sections.push('');
  sections.push(spBlock.body);
  sections.push('');

  sections.push(`## Instructions`);
  sections.push(
    `Implement the sub-prompt "${spBlock.id}: ${spBlock.name}" as described above.`
  );
  sections.push(
    `Produce complete, production-ready TypeScript code for all files listed.`
  );
  sections.push(
    `Return your response as a JSON object with the following shape:`
  );
  sections.push('');
  sections.push(`{`);
  sections.push(`  "files": [`);
  sections.push(`    { "path": "relative/path/to/file.ts", "content": "..." }`);
  sections.push(`  ],`);
  sections.push(`  "commands": ["npm install some-package"],`);
  sections.push(`  "notes": "Any implementation notes or caveats."`);
  sections.push(`}`);

  return sections.join('\n');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const { projectId, specFile, spId } = body as Partial<GeneratedPromptRequest>;

  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json(
      { error: 'projectId is required' },
      { status: 400 }
    );
  }

  if (!specFile || typeof specFile !== 'string') {
    return NextResponse.json(
      { error: 'specFile is required' },
      { status: 400 }
    );
  }

  if (!spId || typeof spId !== 'string') {
    return NextResponse.json(
      { error: 'spId is required' },
      { status: 400 }
    );
  }

  let project: Awaited<ReturnType<typeof getProject>>;
  try {
    project = await getProject(projectId);
  } catch {
    return NextResponse.json(
      { error: `Project not found: ${projectId}` },
      { status: 404 }
    );
  }

  if (!project) {
    return NextResponse.json(
      { error: `Project not found: ${projectId}` },
      { status: 404 }
    );
  }

  const projectRecord = project as unknown as Record<string, unknown>;

  const specDir: string =
    typeof projectRecord.specDir === 'string'
      ? projectRecord.specDir
      : path.resolve(process.cwd(), 'docs', typeof projectRecord.name === 'string' ? projectRecord.name : projectId, 'specs');

  const specFilePath = path.resolve(specDir, specFile);

  let specContent: string;
  try {
    specContent = await readFile(specFilePath, 'utf-8');
  } catch {
    return NextResponse.json(
      { error: `Spec file not found: ${specFile}` },
      { status: 404 }
    );
  }

  const subPrompts = parseSubPrompts(specContent);
  const normalizedSpId = spId.toUpperCase();
  const targetSp = subPrompts.find(
    (sp) => sp.id.toUpperCase() === normalizedSpId
  );

  if (!targetSp) {
    return NextResponse.json(
      { error: `Sub-prompt not found: ${spId}` },
      { status: 404 }
    );
  }

  const specPreamble = extractSpecPreamble(specContent);
  const allSpIds = subPrompts.map((sp) => sp.id);

  const projectName: string =
    typeof projectRecord.name === 'string' ? projectRecord.name : projectId;
  const projectDescription: string =
    typeof projectRecord.description === 'string' ? projectRecord.description : '';

  const prompt = buildPrompt(
    projectName,
    projectDescription,
    specPreamble,
    targetSp,
    allSpIds
  );

  const estimatedTokens = estimateTokens(prompt);

  return NextResponse.json({ prompt, estimatedTokens });
}