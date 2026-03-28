import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface AttemptNoteBody {
  logId: string;
  spId: string;
  attemptIndex: number;
  note: string;
}

interface AttemptEntry {
  attemptIndex?: number;
  note?: string;
  [key: string]: unknown;
}

interface SpEntry {
  attempts?: AttemptEntry[];
  [key: string]: unknown;
}

interface LogData {
  subPrompts?: Record<string, SpEntry>;
  [key: string]: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: AttemptNoteBody;

  try {
    body = (await request.json()) as AttemptNoteBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { logId, spId, attemptIndex, note } = body;

  if (!logId || typeof logId !== 'string') {
    return NextResponse.json({ error: 'logId is required' }, { status: 400 });
  }
  if (!spId || typeof spId !== 'string') {
    return NextResponse.json({ error: 'spId is required' }, { status: 400 });
  }
  if (typeof attemptIndex !== 'number' || attemptIndex < 0) {
    return NextResponse.json({ error: 'attemptIndex must be a non-negative number' }, { status: 400 });
  }
  if (typeof note !== 'string') {
    return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
  }

  const logsDir = path.resolve('docs', 'aidlc', 'logs');
  const logFile = path.resolve(logsDir, `${logId}.json`);

  let logData: LogData;

  try {
    const raw = await fs.readFile(logFile, 'utf-8');
    logData = JSON.parse(raw) as LogData;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: `Log file not found: ${logId}` }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to read log file' }, { status: 500 });
  }

  if (!logData.subPrompts) {
    logData.subPrompts = {};
  }

  if (!logData.subPrompts[spId]) {
    logData.subPrompts[spId] = {};
  }

  const spEntry = logData.subPrompts[spId];

  if (!spEntry.attempts) {
    spEntry.attempts = [];
  }

  const existingAttempt = spEntry.attempts.find(
    (a) => a.attemptIndex === attemptIndex
  );

  if (existingAttempt) {
    existingAttempt.note = note;
  } else {
    spEntry.attempts.push({ attemptIndex, note });
  }

  try {
    await fs.writeFile(logFile, JSON.stringify(logData, null, 2), 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Failed to write log file' }, { status: 500 });
  }

  return NextResponse.json({ success: true, logId, spId, attemptIndex, note });
}