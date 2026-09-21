import { invoke } from "@tauri-apps/api/core";

export interface DesktopSystemInfo {
  os: string;
  arch: string;
  family: string;
  hostname: string | null;
  current_dir: string | null;
}

export const desktopNative = {
  systemInfo: () => invoke<DesktopSystemInfo>("system_info"),
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  revealPath: (path: string) => invoke<void>("reveal_path", { path })
};
