import type MyPlugin from "main";
import { ItemView, WorkspaceLeaf } from "obsidian";
import TogglSidebarPane from "./TogglSidebarPane.svelte";

export const VIEW_TYPE_REPORT = "toggl-report";

export default class TogglReportView extends ItemView {
  private readonly plugin: MyPlugin;
  private content: TogglSidebarPane | undefined;
  private pollHandle: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: MyPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    this.plugin.panelIsVisible = true;

    this.content = new TogglSidebarPane({
      target: this.contentEl,
      props: {
        active: true,
        manualMode: this.plugin.settings.reducedPolling?.manualMode ?? false,
        onManualRefresh: async () => {
          try {
            await (this.plugin.toggl as any).refreshUser?.();
            await (this.plugin.toggl as any).refreshCurrentEntry?.();
            this.plugin.lastKnownTimerRunning = !!(this.plugin.toggl as any).currentTimeEntry;
            this.requestRender();
          } catch (e) {
            console.error("Manual refresh failed:", e);
          }
        },
      },
    });

    this.restartPolling();
  }

  async onClose(): Promise<void> {
    this.plugin.panelIsVisible = false;
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    if (this.content) {
      this.content.$destroy();
      this.content = undefined;
    }
  }

  public restartPolling(): void {
    if (this.pollHandle !== null) {
      window.clearInterval(this.pollHandle);
      this.pollHandle = null;
    }

    if (this.plugin.settings.reducedPolling?.manualMode) return;

    const tick = async () => {
      const hasFocus = (this.plugin as any)["windowHasFocus"] ?? true;
      if (!hasFocus) return;

      if (this.plugin.settings.reducedPolling?.pollOnlyWhenActive) {
        const running = !!this.plugin.lastKnownTimerRunning;
        const panelVisible = !!this.plugin.panelIsVisible;
        if (!running && !panelVisible) return;
      }

      // optional service refresh calls can go here
      this.requestRender();
    };

    void tick();
    const ms = this.plugin.settings.reducedPolling?.pollIntervalMs ?? 15000;
    this.pollHandle = window.setInterval(tick, ms);
  }

  public requestRender(): void {
    this.content?.$set?.({
      active: this.plugin.panelIsVisible,
      manualMode: this.plugin.settings.reducedPolling?.manualMode ?? false,
      __ping: Date.now(),
    });
  }

  getViewType(): string { return VIEW_TYPE_REPORT; }
  getDisplayText(): string { return "Toggl Report"; }
  getIcon(): string { return "clock"; }
}
