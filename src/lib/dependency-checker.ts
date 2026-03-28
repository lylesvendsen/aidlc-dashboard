import fs from 'fs';
import path from 'path';

export interface MissingDependency {
  path: string;
  required: true;
}

export function parseDependencies(specContent: string, spId: string): string[] {
  const lines = specContent.split('\n');
  const normalizedId = spId.toUpperCase().replace(/^SP-?/, '');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^###\s+SP-(\w+):/i);
    if (headingMatch) {
      const headingId = headingMatch[1].toUpperCase();
      if (headingId === normalizedId) {
        if (i > 0) {
          const prevLine = lines[i - 1];
          const dependsMatch = prevLine.match(/^<!--\s*sp-depends:\s*(.*?)\s*-->$/);
          if (dependsMatch) {
            const raw = dependsMatch[1].trim();
            if (!raw) return [];
            return raw.split(',').map((p) => p.trim()).filter(Boolean);
          }
        }
        return [];
      }
    }
  }

  return [];
}

export function checkDependencies(
  specContent: string,
  spId: string,
  appDir: string
): MissingDependency[] {
  const requiredPaths = parseDependencies(specContent, spId);
  const missing: MissingDependency[] = [];

  for (const relativePath of requiredPaths) {
    const absolutePath = path.resolve(appDir, relativePath);
    if (!fs.existsSync(absolutePath)) {
      missing.push({ path: relativePath, required: true });
    }
  }

  return missing;
}