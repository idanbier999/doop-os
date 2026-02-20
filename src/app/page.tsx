import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-6xl mx-auto px-4 py-4">
        <span className="font-[family-name:var(--font-pixel)] text-2xl tracking-tight">
          mangistew
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="border border-mac-border-strong px-6 py-2.5 rounded-lg font-[family-name:var(--font-pixel)] text-sm"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="bg-mac-black text-mac-white hover:bg-mac-dark-gray px-6 py-2.5 rounded-lg font-bold font-[family-name:var(--font-pixel)] text-sm"
          >
            Sign up
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 text-center max-w-4xl mx-auto px-4">
        <h1 className="font-[family-name:var(--font-pixel)] text-5xl md:text-7xl leading-tight mb-6">
          The control plane for autonomous AI
        </h1>
        <p className="font-[family-name:var(--font-body)] text-lg md:text-xl text-mac-dark-gray max-w-2xl mx-auto mb-10">
          Audit, govern, and operate your AI agents from a single dashboard.
        </p>
        <Link
          href="/signup"
          className="bg-mac-black text-mac-white hover:bg-mac-dark-gray px-8 py-3 rounded-lg font-bold font-[family-name:var(--font-pixel)] text-lg inline-block"
        >
          Get started
        </Link>
      </section>

      {/* Pillars */}
      <section className="py-16 max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Audit & Compliance */}
          <div className="mac-window">
            <div className="mac-title-bar">
              <div className="mac-close-box" />
              <span className="mac-title-bar-title">Audit &amp; Compliance</span>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-mac-black"
                >
                  <rect
                    x="6"
                    y="4"
                    width="20"
                    height="24"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="10"
                    y1="10"
                    x2="22"
                    y2="10"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="10"
                    y1="15"
                    x2="22"
                    y2="15"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <line
                    x1="10"
                    y1="20"
                    x2="18"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <p className="font-[family-name:var(--font-body)] text-sm text-mac-dark-gray leading-relaxed">
                Complete audit trail for every agent action. Export to CSV/JSON.
                Know exactly what your agents did, when, and why.
              </p>
            </div>
          </div>

          {/* Trust & Governance */}
          <div className="mac-window">
            <div className="mac-title-bar">
              <div className="mac-close-box" />
              <span className="mac-title-bar-title">Trust &amp; Governance</span>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-mac-black"
                >
                  <path
                    d="M16 4L26 9V15C26 21.075 21.85 26.425 16 28C10.15 26.425 6 21.075 6 15V9L16 4Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points="12,16 15,19 20,13"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="font-[family-name:var(--font-body)] text-sm text-mac-dark-gray leading-relaxed">
                Performance metrics, health monitoring, and problem tracking.
                Build trust in your AI workforce with data.
              </p>
            </div>
          </div>

          {/* Fleet Operations */}
          <div className="mac-window">
            <div className="mac-title-bar">
              <div className="mac-close-box" />
              <span className="mac-title-bar-title">Fleet Operations</span>
            </div>
            <div className="p-5">
              <div className="mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-mac-black"
                >
                  <rect
                    x="4"
                    y="4"
                    width="10"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="18"
                    y="4"
                    width="10"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="4"
                    y="18"
                    width="10"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <rect
                    x="18"
                    y="18"
                    width="10"
                    height="10"
                    rx="1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <p className="font-[family-name:var(--font-body)] text-sm text-mac-dark-gray leading-relaxed">
                Real-time fleet dashboard. Monitor agent health, task
                throughput, and problem trends at a glance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 max-w-4xl mx-auto px-4">
        <h2 className="font-[family-name:var(--font-pixel)] text-3xl md:text-4xl text-center mb-12">
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-10 text-center">
          {/* Step 1 */}
          <div>
            <div className="flex items-center justify-center mb-4">
              <span className="font-[family-name:var(--font-pixel)] text-4xl text-mac-highlight">
                1
              </span>
            </div>
            <div className="flex justify-center mb-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-mac-dark-gray"
              >
                <circle
                  cx="8"
                  cy="14"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="20"
                  cy="14"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="12"
                  y1="14"
                  x2="16"
                  y2="14"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-pixel)] text-lg mb-1">
              Connect agents via MCP
            </h3>
            <p className="font-[family-name:var(--font-body)] text-sm text-mac-gray">
              Point your agents at Mangistew with a single config line.
            </p>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center justify-center mb-4">
              <span className="font-[family-name:var(--font-pixel)] text-4xl text-mac-highlight">
                2
              </span>
            </div>
            <div className="flex justify-center mb-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-mac-dark-gray"
              >
                <rect
                  x="3"
                  y="5"
                  width="22"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="3"
                  y1="9"
                  x2="25"
                  y2="9"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="14"
                  y1="25"
                  x2="14"
                  y2="21"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="10"
                  y1="25"
                  x2="18"
                  y2="25"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-pixel)] text-lg mb-1">
              Monitor from your dashboard
            </h3>
            <p className="font-[family-name:var(--font-body)] text-sm text-mac-gray">
              See every agent, task, and problem in real time.
            </p>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center justify-center mb-4">
              <span className="font-[family-name:var(--font-pixel)] text-4xl text-mac-highlight">
                3
              </span>
            </div>
            <div className="flex justify-center mb-3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-mac-dark-gray"
              >
                <rect
                  x="5"
                  y="3"
                  width="18"
                  height="22"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="9"
                  y1="9"
                  x2="19"
                  y2="9"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="9"
                  y1="13"
                  x2="19"
                  y2="13"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="9"
                  y1="17"
                  x2="15"
                  y2="17"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-pixel)] text-lg mb-1">
              Audit everything
            </h3>
            <p className="font-[family-name:var(--font-body)] text-sm text-mac-gray">
              Full activity log with export. Compliance made simple.
            </p>
          </div>
        </div>
      </section>

      {/* For Developers */}
      <section className="py-16 max-w-3xl mx-auto px-4">
        <h2 className="font-[family-name:var(--font-pixel)] text-3xl md:text-4xl text-center mb-4">
          For developers
        </h2>
        <p className="font-[family-name:var(--font-body)] text-center text-mac-dark-gray mb-8">
          Connect your first agent in under 5 minutes.
        </p>
        <div className="mac-window">
          <div className="mac-title-bar">
            <div className="mac-close-box" />
            <span className="mac-title-bar-title">mcp-config.json</span>
          </div>
          <div className="p-4">
            <pre className="mac-inset rounded-md p-4 text-sm font-mono overflow-x-auto leading-relaxed">
              <code>{`{
  "mcpServers": {
    "mangistew": {
      "command": "npx",
      "args": ["mangistew-mcp"],
      "env": {
        "MANGISTEW_API_KEY": "your-api-key"
      }
    }
  }
}`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="py-20 text-center">
        <h2 className="font-[family-name:var(--font-pixel)] text-3xl md:text-4xl mb-6">
          Start managing your AI workforce
        </h2>
        <Link
          href="/signup"
          className="bg-mac-black text-mac-white hover:bg-mac-dark-gray px-8 py-3 rounded-lg font-bold font-[family-name:var(--font-pixel)] text-lg inline-block"
        >
          Sign up
        </Link>
      </footer>
    </main>
  );
}
