import { NextResponse } from "next/server"
import { listProjects, saveProject, generateId } from "@/lib/projects"
import type { Project } from "@/types"

export async function GET() {
  return NextResponse.json(listProjects())
}

export async function POST(req: Request) {
  const body = await req.json()
  const project: Project = {
    id:             generateId(),
    name:           body.name ?? "New Project",
    description:    body.description ?? "",
    appDir:         body.appDir ?? "",
    specDir:        body.specDir ?? "",
    logsDir:        body.logsDir ?? "",
    model:          body.model ?? "claude-sonnet-4-6",
    projectContext: body.projectContext ?? "",
    constraints:    body.constraints ?? [],
    validation: {
      afterEachSubPrompt: body.validation?.afterEachSubPrompt ?? ["npm run typecheck","npm run lint","npm run test"],
      afterUnit:          body.validation?.afterUnit ?? ["npm run typecheck","npm run lint","npm run test","npm run build"],
    },
    git: {
      autoCommit:    body.git?.autoCommit ?? true,
      autoTag:       body.git?.autoTag ?? true,
      commitMessage: body.git?.commitMessage ?? "{unitId} complete: {unitTitle}",
      tagTemplate:   body.git?.tagTemplate ?? "{unitId}-{timestamp}",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  saveProject(project)
  return NextResponse.json(project, { status: 201 })
}
