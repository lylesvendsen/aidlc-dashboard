'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { GraphData, GraphNode, GraphEdge } from '@/lib/graph';

interface DependencyGraphProps {
  data: GraphData;
  projectId: string;
}

function getNodeColors(status: GraphNode['status']): {
  border: string;
  text: string;
  dot: string;
  bg: string;
} {
  switch (status) {
    case 'passed':
      return {
        border: 'border-green-500',
        text: 'text-green-700',
        dot: 'bg-green-500',
        bg: 'bg-green-50',
      };
    case 'failed':
      return {
        border: 'border-red-500',
        text: 'text-red-700',
        dot: 'bg-red-500',
        bg: 'bg-red-50',
      };
    case 'running':
      return {
        border: 'border-blue-500',
        text: 'text-blue-700',
        dot: 'bg-blue-500',
        bg: 'bg-blue-50',
      };
    default:
      return {
        border: 'border-gray-300',
        text: 'text-gray-500',
        dot: 'bg-gray-400',
        bg: 'bg-gray-50',
      };
  }
}

function StatusDot({ status }: { status: GraphNode['status'] }) {
  const colors = getNodeColors(status);
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors.dot} ${
        status === 'running' ? 'animate-pulse' : ''
      }`}
      aria-label={status}
    />
  );
}

interface NodeCardProps {
  node: GraphNode;
  projectId: string;
}

function NodeCard({ node, projectId }: NodeCardProps) {
  const router = useRouter();
  const colors = getNodeColors(node.status);

  function handleClick() {
    router.push(`/projects/${projectId}/specs/${encodeURIComponent(node.filePath)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        relative flex flex-col gap-1 px-3 py-2 rounded-lg border-2 cursor-pointer
        min-w-[120px] max-w-[160px] select-none
        transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400
        ${colors.border} ${colors.bg}
      `}
      title={node.title}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`
            text-xs font-bold px-1.5 py-0.5 rounded
            ${colors.text} bg-white border ${colors.border}
          `}
        >
          {node.id}
        </span>
        <StatusDot status={node.status} />
      </div>
      <p
        className={`text-xs font-medium leading-tight truncate ${colors.text}`}
        title={node.title}
      >
        {node.title}
      </p>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center self-center" aria-hidden="true">
      <div className="w-6 h-px bg-gray-400" />
      <svg
        width="8"
        height="12"
        viewBox="0 0 8 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-400"
      >
        <path
          d="M0 0L8 6L0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function buildRows(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[][] {
  if (nodes.length === 0) return [];

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list) {
      list.push(edge.to);
    }
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const levelMap = new Map<string, number>();
  const queue: string[] = [];

  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
      levelMap.set(node.id, 0);
    }
  }

  const inDegreeCopy = new Map(inDegree);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levelMap.get(current) ?? 0;
    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const existingLevel = levelMap.get(neighbor) ?? -1;
      const newLevel = currentLevel + 1;
      if (newLevel > existingLevel) {
        levelMap.set(neighbor, newLevel);
      }
      inDegreeCopy.set(neighbor, (inDegreeCopy.get(neighbor) ?? 1) - 1);
      if ((inDegreeCopy.get(neighbor) ?? 0) <= 0) {
        queue.push(neighbor);
      }
    }
  }

  const nodeById = new Map<string, GraphNode>();
  for (const node of nodes) {
    nodeById.set(node.id, node);
  }

  const maxLevel = Math.max(...Array.from(levelMap.values()), 0);
  const rows: GraphNode[][] = [];

  for (let level = 0; level <= maxLevel; level++) {
    const row: GraphNode[] = [];
    for (const [id, l] of levelMap.entries()) {
      if (l === level) {
        const n = nodeById.get(id);
        if (n) row.push(n);
      }
    }
    if (row.length > 0) rows.push(row);
  }

  const assignedIds = new Set(levelMap.keys());
  const unassigned: GraphNode[] = nodes.filter((n) => !assignedIds.has(n.id));
  if (unassigned.length > 0) {
    rows.push(unassigned);
  }

  return rows;
}

function RowWithArrows({
  row,
  edges,
  projectId,
}: {
  row: GraphNode[];
  edges: GraphEdge[];
  projectId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {row.map((node, idx) => {
        const hasEdgeToNext =
          idx < row.length - 1 &&
          edges.some((e) => e.from === node.id && e.to === row[idx + 1]?.id);

        return (
          <div key={node.id} className="flex items-center">
            <NodeCard node={node} projectId={projectId} />
            {idx < row.length - 1 && hasEdgeToNext && <Arrow />}
            {idx < row.length - 1 && !hasEdgeToNext && (
              <div className="w-4" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DependencyGraph({ data, projectId }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = data;

  const rows = buildRows(nodes, edges);

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-500">No specs found to display in the dependency graph.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-gray-200 bg-white p-4 overflow-x-auto"
      aria-label="Project dependency graph"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Dependency Graph</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" />
            Not run
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
            Passed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
            Failed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 min-w-max">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex items-center gap-2">
            <RowWithArrows row={row} edges={edges} projectId={projectId} />
          </div>
        ))}
      </div>
    </div>
  );
}