import { type Action } from "@/lib/solar-core";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

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

  return {
    url: endpoint.toString(),
    token,
  };
}

async function bridge(action: unknown) {
  const config = integration();

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: config.token,
      ...(action as object),
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error("The Sheets connection is unavailable.");
  }

  const data = (await response.json()) as {
    ok?: boolean;
    error?: string;
    [key: string]: unknown;
  };

  if (!data.ok) {
    throw new Error(data.error || "The Sheet could not be updated.");
  }

  return data;
}

const allowedActions = [
  "create_lead",
  "update_lead",
  "add_followup",
  "complete_followup",
  "schedule_visit",
  "update_visit",
  "create_proposal",
  "update_proposal",
  "reconcile_delivery",
];

export async function GET() {
  try {
    const data = await bridge({ type: "snapshot" });

    return reply({
      state: data.state,
      mode: "sheets",
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the private workspace.",
      },
      503,
    );
  }
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");

  if (origin !== new URL(request.url).origin) {
    return reply({ error: "Invalid request origin." }, 403);
  }

  try {
    const raw = await request.text();

    if (raw.length > 40000) {
      return reply({ error: "This request is too large." }, 413);
    }

    const data = JSON.parse(raw) as Action & {
      expected_version: number;
    };

    if (!allowedActions.includes(data.type)) {
      return reply({ error: "Unsupported workspace action." }, 400);
    }

    const outcome = await bridge({
      ...data,
      actor:
        process.env.SOLAR_OPERATOR_EMAIL?.trim() ||
        "Private Solar operator",
    });

    return reply({
      ...outcome,
      mode: "sheets",
    });
  } catch (error) {
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save the change.",
      },
      400,
    );
  }
}