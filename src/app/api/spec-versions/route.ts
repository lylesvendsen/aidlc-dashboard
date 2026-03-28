import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { listVersions, getVersion, restoreVersion } from '@/lib/spec-versions';
import { readFileSync, existsSync } from 'fs';

function getProjectLogsDir(projectId: string): string {
  const dataDir = path.resolve(process.cwd(), 'data', 'projects');
  const projectFilePath = path.resolve(dataDir, `${projectId}.json`);

  if (!existsSync(projectFilePath)) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const raw = readFileSync(projectFilePath, 'utf-8');
  const project = JSON.parse(raw) as { logsDir?: string };

  if (!project.logsDir) {
    throw new Error(`Project ${projectId} has no logsDir configured`);
  }

  return path.resolve(project.logsDir);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId');
    const specId = searchParams.get('specId');
    const specPath = searchParams.get('specPath');
    const versionId = searchParams.get('versionId');

    if (!projectId || !specId) {
      return NextResponse.json(
        { error: 'projectId and specId are required' },
        { status: 400 }
      );
    }

    const logsDir = getProjectLogsDir(projectId);

    if (versionId) {
      const content = getVersion(logsDir, specId, versionId);
      return NextResponse.json({ content });
    }

    if (!specPath) {
      return NextResponse.json(
        { error: 'specPath is required when listing versions' },
        { status: 400 }
      );
    }

    const resolvedSpecPath = path.resolve(specPath);
    const versions = listVersions(resolvedSpecPath, logsDir);
    return NextResponse.json({ versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      projectId?: string;
      specId?: string;
      specPath?: string;
      versionId?: string;
    };

    const { projectId, specId, specPath, versionId } = body;

    if (!projectId || !specId || !specPath || !versionId) {
      return NextResponse.json(
        { error: 'projectId, specId, specPath, and versionId are required' },
        { status: 400 }
      );
    }

    const logsDir = getProjectLogsDir(projectId);
    const resolvedSpecPath = path.resolve(specPath);

    restoreVersion(resolvedSpecPath, logsDir, specId, versionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}