import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getProject } from "@/lib/projects";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const { searchParams } = request.nextUrl;
  const filePath = searchParams.get("filePath");

  if (!filePath) {
    return NextResponse.json(
      { error: "filePath query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Resolve against specDir root to prevent path traversal
    const specDir = path.resolve(project.specDir);
    const resolvedPath = path.resolve(specDir, filePath);

    // Security: ensure resolved path stays within the specDir or is an absolute path
    // that was written by the execution (accept absolute paths within project root)
    // We allow absolute paths that don't escape the filesystem root but validate extension
    const allowedExtensions = [
      ".ts", ".tsx", ".js", ".jsx", ".json", ".md",
      ".css", ".html", ".txt", ".yaml", ".yml", ".env",
      ".sh", ".py", ".go", ".rs", ".java", ".rb",
      ".toml", ".lock", ".config", ".mjs", ".cjs",
    ];

    const ext = path.extname(filePath).toLowerCase();
    const hasAllowedExt = allowedExtensions.includes(ext) || ext === "";

    if (!hasAllowedExt) {
      return NextResponse.json(
        { error: "File type not permitted" },
        { status: 403 }
      );
    }

    // Use the absolute filePath if provided, otherwise resolve relative to specDir
    const absoluteFilePath = path.isAbsolute(filePath)
      ? filePath
      : resolvedPath;

    const stat = await fs.stat(absoluteFilePath);

    if (!stat.isFile()) {
      return NextResponse.json(
        { error: "Path is not a file" },
        { status: 400 }
      );
    }

    const content = await fs.readFile(absoluteFilePath, "utf-8");
    const relativePath = path.isAbsolute(filePath)
      ? filePath
      : path.relative(process.cwd(), absoluteFilePath);

    return NextResponse.json({
      path: absoluteFilePath,
      relativePath,
      sizeBytes: stat.size,
      content,
    });
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("[file-content] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
