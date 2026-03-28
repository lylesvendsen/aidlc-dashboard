import fs from 'fs';
import path from 'path';

export interface VersionMeta {
  versionId: string;
  timestamp: string;
  sizeBytes: number;
  specId: string;
}

function getSpecId(specPath: string): string {
  return path.basename(specPath, path.extname(specPath));
}

function getVersionsDir(logsDir: string, specId: string): string {
  return path.resolve(logsDir, 'spec-versions', specId);
}

function formatTimestamp(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${dd}-${HH}${mm}${ss}`;
}

function parseTimestampFromVersionId(versionId: string): string {
  // versionId format: {specId}-{YYYYMMDD-HHmmss}
  // Extract the timestamp portion: last 15 chars = YYYYMMDD-HHmmss
  const parts = versionId.split('-');
  if (parts.length < 3) return versionId;
  // timestamp is the last two segments: YYYYMMDD and HHmmss
  const datePart = parts[parts.length - 2];
  const timePart = parts[parts.length - 1];
  if (!datePart || !timePart) return versionId;

  const year = datePart.slice(0, 4);
  const month = datePart.slice(4, 6);
  const day = datePart.slice(6, 8);
  const hour = timePart.slice(0, 2);
  const min = timePart.slice(2, 4);
  const sec = timePart.slice(4, 6);

  return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
}

export function saveVersion(specPath: string, logsDir: string, content: string): void {
  const specId = getSpecId(specPath);
  const versionsDir = getVersionsDir(logsDir, specId);

  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  const timestamp = formatTimestamp(new Date());
  const filename = `${specId}-${timestamp}.md`;
  const filePath = path.resolve(versionsDir, filename);

  fs.writeFileSync(filePath, content, 'utf-8');
}

export function listVersions(specPath: string, logsDir: string): VersionMeta[] {
  const specId = getSpecId(specPath);
  const versionsDir = getVersionsDir(logsDir, specId);

  if (!fs.existsSync(versionsDir)) {
    return [];
  }

  const files = fs.readdirSync(versionsDir).filter((f) => f.endsWith('.md'));

  const versions: VersionMeta[] = files.map((filename) => {
    const filePath = path.resolve(versionsDir, filename);
    const stats = fs.statSync(filePath);
    const versionId = path.basename(filename, '.md');
    const timestamp = parseTimestampFromVersionId(versionId);

    return {
      versionId,
      timestamp,
      sizeBytes: stats.size,
      specId,
    };
  });

  versions.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return versions;
}

export function getVersion(logsDir: string, specId: string, versionId: string): string {
  const versionsDir = getVersionsDir(logsDir, specId);
  const filePath = path.resolve(versionsDir, `${versionId}.md`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Version not found: ${versionId}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function restoreVersion(
  specPath: string,
  logsDir: string,
  specId: string,
  versionId: string
): void {
  // Save current content as a new version first
  if (fs.existsSync(specPath)) {
    const currentContent = fs.readFileSync(specPath, 'utf-8');
    saveVersion(specPath, logsDir, currentContent);
  }

  // Read the requested version
  const versionContent = getVersion(logsDir, specId, versionId);

  // Write the old version content to the spec file
  const specDir = path.dirname(specPath);
  if (!fs.existsSync(specDir)) {
    fs.mkdirSync(specDir, { recursive: true });
  }

  fs.writeFileSync(specPath, versionContent, 'utf-8');
}