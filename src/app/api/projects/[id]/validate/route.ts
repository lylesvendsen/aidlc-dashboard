import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projects";
import { ValidationResult } from "@/types";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ValidateRequestBody {
  spId: string;
}

const VALIDATION_COMMANDS = [
  "npm run typecheck",
  "npm run lint",
  "npm run test",
];

async function runCommand(
  command: string,
  cwd: string
): Promise<{ exitCode: number; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 120_000,
    });
    return { exitCode: 0, output: [stdout, stderr].filter(Boolean).join("\n") };
  } catch (err) {
    const execErr = err as { code?: number; stdout?: string; stderr?: string };
    const output = [
      execErr.stdout ?? "",
      execErr.stderr ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    return { exitCode: execErr.code ?? 1, output };
  }
}

function countErrors(output: string, command: string): number {
  if (command.includes("lint")) {
    const match = output.match(/(\d+)\s+error/i);
    return match ? parseInt(match[1], 10) : 0;
  }
  if (command.includes("typecheck") || command.includes("tsc")) {
    const match = output.match(/(\d+)\s+error/i);
    return match ? parseInt(match[1], 10) : 0;
  }
  return 0;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;

  let body: ValidateRequestBody;
  try {
    body = await request.json() as ValidateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.spId) {
    return NextResponse.json(
      { error: "spId is required" },
      { status: 400 }
    );
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const cwd = path.resolve(project.specDir);
    const results: ValidationResult[] = [];
    let priorFailed = false;

    for (const command of VALIDATION_COMMANDS) {
      if (priorFailed) {
        results.push({
          command,
          status: "skipped",
          output: "",
          errorCount: 0,
          passed: true,
        });
        continue;
      }

      const start = Date.now();
      const { exitCode, output } = await runCommand(command, cwd);
      const durationMs = Date.now() - start;

      const passed = exitCode === 0;
      if (!passed) priorFailed = true;

      results.push({
        command,
        status: passed ? "passed" : "failed",        passed: passed,
        output,
        errorCount: passed ? 0 : countErrors(output, command),
      });
    }

    const overallStatus = results.some((r) => r.status === "failed")
      ? "failed"
      : "passed";

    return NextResponse.json({
      status: overallStatus,
      validation: results,
      spId: body.spId,
    });
  } catch (err) {
    console.error("[validate] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
