import { getProject } from "@/lib/projects"
import { parseSpec } from "@/lib/specs"
import { runSpec } from "@/lib/runner"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  const specFile  = searchParams.get("specFile")
  const fromSpId  = searchParams.get("fromSpId") ?? undefined
  const onlySpId  = searchParams.get("onlySpId") ?? undefined
  const dryRun    = searchParams.get("dryRun") === "true"

  if (!projectId || !specFile) {
    return new Response("projectId and specFile required", { status: 400 })
  }

  const project = getProject(projectId)
  if (!project) return new Response("Project not found", { status: 404 })

  const spec = parseSpec(decodeURIComponent(specFile))

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runSpec(project, spec, fromSpId, onlySpId, dryRun)) {
          controller.enqueue(encoder.encode("data: " + JSON.stringify(event) + "\n\n"))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(encoder.encode(
          'data: {"type":"error","message":"' + msg.replace(/"/g, '\\"') + '"}\n\n'
        ))
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    }
  })
}
