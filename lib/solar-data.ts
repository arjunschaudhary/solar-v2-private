import { demoWorkspace, type Action, type Workspace } from "@/lib/solar-core";

export type WorkspaceMode = "showcase" | "sheets";

export const publicShowcase = () =>
  process.env.SOLAR_PUBLIC_SHOWCASE?.trim() === "Yes";

function integration() {
  const url = process.env.SOLAR_APPS_SCRIPT_URL?.trim();
  const token = process.env.SOLAR_AUTOMATION_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "The private Sheets connection is not configured. Set both server integration values.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("Invalid integration URL.");
  }

  if (
    endpoint.protocol !== "https:" ||
    endpoint.hostname !== "script.google.com" ||
    !endpoint.pathname.endsWith("/exec")
  ) {
    throw new Error("Invalid integration URL.");
  }

  return { url: endpoint.toString(), token };
}

export async function bridge(action: Action | Record<string, unknown>) {
  const config = integration();
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: config.token, ...action }),
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) throw new Error("The Sheets connection is unavailable.");

  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    state?: Workspace;
    [key: string]: unknown;
  };

  if (!data.ok) throw new Error(data.error || "The Sheet could not be updated.");
  return data;
}

export async function getWorkspaceSnapshot(): Promise<{
  state: Workspace;
  mode: WorkspaceMode;
}> {
  // This branch is deliberately first: a public deployment must never request
  // the private workbook, even when valid Sheets credentials are present.
  if (publicShowcase()) {
    return { state: demoWorkspace(), mode: "showcase" };
  }

  const data = await bridge({ type: "snapshot" });
  if (!data.state) throw new Error("The workspace response was incomplete.");
  return { state: data.state, mode: "sheets" };
}
