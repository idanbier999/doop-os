"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useMobileSidebar } from "@/contexts/mobile-sidebar-context";

const navItems = [
  { label: "Fleet", href: "/dashboard", icon: "▣" },
  { label: "Agents", href: "/dashboard/agents", icon: "◆" },
  { label: "Audit Trail", href: "/dashboard/activity", icon: "◷" },
  { label: "Problems", href: "/dashboard/problems", icon: "⚠" },
  { label: "Projects", href: "/dashboard/projects", icon: "◈" },
  { label: "API Docs", href: "/dashboard/docs", icon: "◎" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙" },
];

interface SidebarProps {
  userEmail: string;
  workspaceName: string;
}

export function Sidebar({ userEmail, workspaceName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, close } = useMobileSidebar();

  // Close mobile sidebar on route change
  useEffect(() => {
    close();
  }, [pathname, close]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={close}
        />
      )}

      <aside
        className={`
          flex flex-col w-56 h-screen glass-panel bg-mac-light-gray/80 border-r border-mac-border shrink-0
          fixed z-50 top-0 left-0 transition-transform duration-200 md:static md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Apple-inspired header */}
        <div className="px-4 py-3 border-b border-mac-border">
          <div className="flex items-center gap-2">
            {/* Rainbow Apple-inspired gradient bar */}
            <div className="w-3 h-5 rounded-sm" style={{
              background: "linear-gradient(to bottom, #61BB46, #FDB827, #F5821F, #E03A3E, #963D97, #009DDC)"
            }} />
            <h1 className="text-lg font-bold text-mac-black font-[family-name:var(--font-pixel)]">Tarely</h1>
          </div>
          <p className="text-[11px] text-mac-dark-gray mt-0.5 truncate font-[family-name:var(--font-pixel)]">{workspaceName}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-[family-name:var(--font-pixel)] transition-colors duration-150 ${
                isActive(item.href)
                  ? "bg-mac-highlight text-mac-highlight-text"
                  : "text-mac-black hover:bg-mac-highlight-soft"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-mac-border space-y-1">
          <p className="px-3 text-[11px] text-mac-dark-gray truncate font-[family-name:var(--font-pixel)]">{userEmail}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-mac-black hover:bg-mac-highlight-soft transition-colors duration-150 font-[family-name:var(--font-pixel)]"
          >
            <span className="text-base leading-none">⊳</span>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
