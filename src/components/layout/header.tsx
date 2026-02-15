interface HeaderProps {
  workspaceName: string;
}

export function Header({ workspaceName }: HeaderProps) {
  return (
    <header className="flex items-center h-8 px-4 border-b border-mac-black bg-mac-white shrink-0">
      <span className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        &#9776; {workspaceName}
      </span>
    </header>
  );
}
