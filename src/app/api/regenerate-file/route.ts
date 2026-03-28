import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

interface RegenerateFileRequest {
  projectId: string;
  specFile: string;
  spId: string;
  filePath: string;
  instructions?: string;
}

interface ProjectData {
  id: string;
  name: string;
  specDir: string;
  logsDir: string;
  rootDir?: string;
}

function loadProject(projectId: string): ProjectData | null {
  const projectPath = path.resolve('data', 'projects', `${projectId}.json`);
  if (!fs.existsSync(projectPath)) return null;
  const raw = fs.readFileSync(projectPath, 'utf-8');
  return JSON.parse(raw) as ProjectData;
}

function readSpecFile(specDir: string, specFile: string): string | null {
  const specPath = path.resolve(specDir, specFile);
  if (!fs.existsSync(specPath)) return null;
  return fs.readFileSync(specPath, 'utf-8');
}

function extractSpBody(specContent: string, spId: string): string | null {
  const lines = specContent.split('\n');
  const spIdUpper = spId.toUpperCase();
  let inSp = false;
  let spLines: string[] = [];
  let foundSp = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^###\s+(SP-\d+)/i);

    if (headerMatch) {
      const foundId = headerMatch[1].toUpperCase();
      if (foundId === spIdUpper) {
        inSp = true;
        foundSp = true;
        spLines.push(line);
        continue;
      } else if (inSp) {
        break;
      }
    }

    if (inSp) {
      spLines.push(line);
    }
  }

  if (!foundSp) return null;
  return spLines.join('\n').trim();
}

function readCurrentFileContent(rootDir: string | undefined, filePath: string): string {
  if (!rootDir) return '';
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(rootDir, filePath);
  if (!fs.existsSync(absolutePath)) return '';
  return fs.readFileSync(absolutePath, 'utf-8');
}

function buildFocusedPrompt(
  specContent: string,
  spBody: string,
  filePath: string,
  currentContent: string,
  instructions?: string
): string {
  const filename = path.basename(filePath);

  let prompt = `You are regenerating a single file as part of an AI-Driven Development Lifecycle project.

Below is the full spec for context, followed by the specific sub-prompt that produced the original file, followed by the current file content. Your task is to regenerate ONLY the file at path: ${filePath}

## Full Spec
${specContent}

## Sub-Prompt Body
${spBody}

## File to Regenerate
Path: ${filePath}
Filename: ${filename}

## Current File Content
${currentContent ? `\`\`\`\n${currentContent}\n\`\`\`` : '(File does not exist yet — this will be a new file)'}
`;

  if (instructions && instructions.trim()) {
    prompt += `\n## Additional Instructions\n${instructions.trim()}\n`;
  }

  prompt += `
## Instructions
Regenerate the file at ${filePath}. Return ONLY the complete file content with no explanation, no markdown code fences, no preamble, and no trailing commentary. Start immediately with the file content.`;

  return prompt;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: RegenerateFileRequest;
  try {
    body = (await req.json()) as RegenerateFileRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { projectId, specFile, spId, filePath, instructions } = body;

  if (!projectId || !specFile || !spId || !filePath) {
    return NextResponse.json(
      { error: 'projectId, specFile, spId, and filePath are required' },
      { status: 400 }
    );
  }

  const project = loadProject(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const specContent = readSpecFile(project.specDir, specFile);
  if (specContent === null) {
    return NextResponse.json({ error: 'Spec file not found' }, { status: 404 });
  }

  const spBody = extractSpBody(specContent, spId);
  if (spBody === null) {
    return NextResponse.json(
      { error: `Sub-prompt ${spId} not found in spec file` },
      { status: 404 }
    );
  }

  const currentContent = readCurrentFileContent(project.rootDir, filePath);

  const prompt = buildFocusedPrompt(
    specContent,
    spBody,
    filePath,
    currentContent,
    instructions
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
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

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'No text content in Claude response' },
        { status: 500 }
      );
    }

    const newContent = textBlock.text;

    return NextResponse.json({ newContent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Claude API error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}