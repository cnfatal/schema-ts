import type { ReactNode } from "react";
import { Region } from "@/components/region";
import { SplitPane } from "@/components/split-pane";

export interface WorkbenchLayoutProps {
  topBar: ReactNode;
  schema: ReactNode;
  values: ReactNode;
  preview: ReactNode;
  log: ReactNode;
  statusBar: ReactNode;
}

/**
 * Resizable workbench: title bar, editor/preview area, bottom log and status
 * bar. Every region is its own card, so resizing shows a clear gutter on both
 * axes.
 */
export function WorkbenchLayout({
  topBar,
  schema,
  values,
  preview,
  log,
  statusBar,
}: WorkbenchLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/40 text-foreground">
      {topBar}

      <div className="flex min-h-0 flex-1 p-2">
        <SplitPane
          direction="vertical"
          defaultSize={74}
          minPrimary={240}
          minSecondary={120}
          storageKey="schema-ts:log-size"
          primary={
            <SplitPane
              direction="horizontal"
              defaultSize={42}
              minPrimary={260}
              minSecondary={300}
              storageKey="schema-ts:main-split"
              primary={
                <SplitPane
                  direction="vertical"
                  defaultSize={50}
                  minPrimary={140}
                  minSecondary={140}
                  storageKey="schema-ts:editor-split"
                  primary={<Region>{schema}</Region>}
                  secondary={<Region>{values}</Region>}
                />
              }
              secondary={<Region>{preview}</Region>}
            />
          }
          secondary={<Region>{log}</Region>}
        />
      </div>

      {statusBar}
    </div>
  );
}
