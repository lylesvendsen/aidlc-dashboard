import Link from "next/link"

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto py-16 text-center space-y-6">
      <h1 className="text-4xl font-semibold">AIDLC Dashboard</h1>
      <p className="text-gray-500 text-lg">
        AI-Driven Development Lifecycle — manage projects, specs, prompts, and execution.
      </p>
      <Link href="/projects" className="inline-block btn-primary text-base px-8 py-3">
        View Projects
      </Link>
    </div>
  )
}
