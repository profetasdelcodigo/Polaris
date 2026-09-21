import type { DeviceType, SkillSummary } from "@polaris/contracts";
import { ToolEngine } from "./tools/toolEngine.js";

export interface SkillRecipe {
  domain: string;
  action: string;
  object: string;
  devices: readonly DeviceType[];
  status: "PLANNED";
}

const domains = [
  "system",
  "files",
  "browser",
  "desktop",
  "android",
  "web",
  "media",
  "vision",
  "voice",
  "calendar",
  "communication",
  "developer",
  "automation",
  "knowledge",
  "productivity",
  "personal",
  "network",
  "security",
  "iot",
  "robot"
] as const;

const actions = [
  "open",
  "close",
  "read",
  "write",
  "search",
  "find",
  "summarize",
  "compare",
  "organize",
  "schedule",
  "cancel",
  "rename",
  "move",
  "copy",
  "download",
  "upload",
  "capture",
  "transcribe",
  "translate",
  "convert",
  "monitor",
  "diagnose",
  "plan",
  "execute",
  "verify",
  "recover",
  "notify",
  "share",
  "sync",
  "switch",
  "inspect",
  "index",
  "tag",
  "filter",
  "export",
  "import",
  "launch",
  "focus",
  "arrange",
  "automate",
  "delegate",
  "handoff",
  "observe",
  "route",
  "remember",
  "forget",
  "protect",
  "unlock",
  "lock"
] as const;

const objects = [
  "app",
  "window",
  "tab",
  "page",
  "file",
  "folder",
  "text",
  "image",
  "video",
  "audio",
  "screen",
  "camera",
  "microphone",
  "notification",
  "calendar",
  "meeting",
  "contact",
  "message",
  "clipboard",
  "device",
  "wifi",
  "bluetooth",
  "printer",
  "project",
  "repository",
  "build",
  "test",
  "log",
  "memory",
  "conversation",
  "routine",
  "workflow",
  "robot",
  "sensor",
  "task",
  "report",
  "document",
  "spreadsheet",
  "presentation",
  "bookmark",
  "download",
  "setting",
  "permission",
  "process",
  "service",
  "command",
  "shortcut",
  "workspace"
] as const;

const generatedRecipes: SkillRecipe[] = [];
for (const domain of domains) {
  for (const action of actions) {
    for (const object of objects) {
      generatedRecipes.push({
        domain,
        action,
        object,
        devices: domain === "android"
          ? ["ANDROID"]
          : domain === "desktop"
            ? ["DESKTOP"]
            : domain === "robot" || object === "robot" || object === "sensor"
              ? ["ROBOT"]
              : ["WEB", "ANDROID", "DESKTOP"],
        status: "PLANNED"
      });
    }
  }
}

const catalogDevices = ["WEB", "ANDROID", "DESKTOP", "ROBOT"] as const;

export const skillCatalogCapacity = generatedRecipes.length;

export const skillCatalogCapacityByDevice = Object.fromEntries(
  catalogDevices.map((device) => [
    device,
    generatedRecipes.filter((recipe) => recipe.devices.includes(device)).length
  ])
) as Record<(typeof catalogDevices)[number], number>;

export function listSkillCatalog(): readonly SkillSummary[] {
  const available = new ToolEngine().list().map((tool) => ({
    id: `tool.${tool.name}`,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    status: "AVAILABLE" as const,
    supportedDevices: ["WEB", "ANDROID", "DESKTOP"] as const,
    requiresConfirmation: tool.riskLevel !== "LOW"
  }));

  return [
    ...available,
    ...generatedRecipes.map((recipe) => ({
      id: `recipe.${recipe.domain}.${recipe.action}.${recipe.object}`,
      name: `${recipe.action} ${recipe.object}`,
      description: `Blueprint composable para ${recipe.action} de ${recipe.object} dentro de ${recipe.domain}.`,
      category: recipe.domain.toUpperCase(),
      status: recipe.status,
      supportedDevices: recipe.devices,
      requiresConfirmation: true
    }))
  ];
}
