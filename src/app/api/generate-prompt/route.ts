import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { getProject } from "@/lib/projects"

export async function POST(req: Request) {
  const { projectId, description, spId, specContext } = await req.json()
  const project = getProject(projectId)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const systemPrompt = `You are an expert at writing AIDLC sub-prompt specifications.
A sub-prompt is a focused implementation instruction for an AI coding agent.
It must be specific, actionable, and testable.

Project context:
${project.projectContext}

Project constraints:
${project.constraints.map(c => "- " + c).join("\n")}

${specContext ? "Spec context:\n" + specContext : ""}

Write a sub-prompt body for ${spId ?? "a new sub-prompt"}.
Include:
- Exact files to create or modify (full relative paths)
- Key interfaces or patterns to implement
- Any critical constraints specific to this sub-prompt
Keep it concise but complete. Do not include the Acceptance section — that will be added separately.`

  const message = await client.messages.create({
    model:     project.model,
    max_tokens: 2048,
    messages: [{
      role:    "user",
      content: "Generate a sub-prompt body for this requirement:\n\n" + description,
    }],
    system: systemPrompt,
  })

  const text = message.content.find(b => b.type === "text")?.text ?? ""
  return NextResponse.json({ content: text, tokens: { input: message.usage.input_tokens, output: message.usage.output_tokens } })
}
