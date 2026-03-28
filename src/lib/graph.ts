import { SpecFile, ExecutionLog } from '@/types';

export type NodeStatus = 'not-run' | 'passed' | 'failed' | 'running';

export interface GraphNode {
  id: string;
  title: string;
  status: NodeStatus;
  filePath: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function extractUnitId(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  const withoutExt = basename.replace(/\.[^.]+$/, '');
  const match = withoutExt.match(/^([A-Za-z]\d+)/);
  if (match) return match[1].toUpperCase();
  return withoutExt.toUpperCase();
}

function extractTitle(specContent: string): string {
  const lines = specContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      return trimmed.slice(2).trim();
    }
  }
  return '';
}

function extractNextUnit(specContent: string): string | null {
  const lines = specContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^##?\s*Next\s+unit[:\s]+(.+)$/i);
    if (match) {
      const value = match[1].trim();
      const unitMatch = value.match(/([A-Za-z]\d+)/);
      if (unitMatch) return unitMatch[1].toUpperCase();
      return value;
    }
    const kvMatch = trimmed.match(/^[Nn]ext\s+[Uu]nit\s*:\s*(.+)$/);
    if (kvMatch) {
      const value = kvMatch[1].trim();
      const unitMatch = value.match(/([A-Za-z]\d+)/);
      if (unitMatch) return unitMatch[1].toUpperCase();
      return value;
    }
  }
  return null;
}

function computeStatus(unitId: string, logs: ExecutionLog[]): NodeStatus {
  const unitLogs = logs.filter((log) => {
    const logUnit = log.unitId ?? '';
    return logUnit.toUpperCase() === unitId.toUpperCase();
  });

  if (unitLogs.length === 0) return 'not-run';

  const sorted = [...unitLogs].sort((a, b) => {
    const aTime = a.timestamp ?? '';
    const bTime = b.timestamp ?? '';
    return bTime.localeCompare(aTime);
  });

  const latest = sorted[0];
  const overallStatus = latest.status ?? '';

  if (overallStatus === 'in_progress') {
    return 'running';
  }
  if (overallStatus === 'passed') {
    return 'passed';
  }
  if (overallStatus === 'failed') {
    return 'failed';
  }

  return 'not-run';
}

export function buildGraph(specs: SpecFile[], logs: ExecutionLog[]): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const nodeIdSet = new Set<string>();

  for (const spec of specs) {
    const unitId = extractUnitId(spec.filePath ?? spec.id ?? '');
    if (nodeIdSet.has(unitId)) continue;
    nodeIdSet.add(unitId);

    const content = spec.rawContent ?? '';
    const title = extractTitle(content) || spec.title || unitId;
    const status = computeStatus(unitId, logs);

    nodes.push({
      id: unitId,
      title,
      status,
      filePath: spec.filePath ?? spec.id ?? '',
    });
  }

  for (const spec of specs) {
    const content = spec.rawContent ?? '';
    const fromId = extractUnitId(spec.filePath ?? spec.id ?? '');
    const nextUnit = extractNextUnit(content);

    if (nextUnit && nodeIdSet.has(nextUnit)) {
      const alreadyExists = edges.some(
        (e) => e.from === fromId && e.to === nextUnit
      );
      if (!alreadyExists && fromId !== nextUnit) {
        edges.push({ from: fromId, to: nextUnit });
      }
    }
  }

  return { nodes, edges };
}