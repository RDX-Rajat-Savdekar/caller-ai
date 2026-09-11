export function ConsoleShell({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-8 py-4">
          <p className="text-lg font-semibold">vouch</p>
          {title ? <span className="min-w-0 truncate text-sm text-mute">{title}</span> : null}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <p className="tabular text-sm font-semibold">20 left</p>
              <p className="text-xs text-mute">of 20 · fixture</p>
            </div>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
              <div className="h-full w-full rounded-full bg-ink" />
            </div>
            <button
              type="button"
              className="rounded-full border border-critical px-4 py-1.5 text-sm font-medium text-critical"
            >
              Kill switch
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1200px] space-y-6 px-8 py-8">{children}</div>
    </div>
  );
}
