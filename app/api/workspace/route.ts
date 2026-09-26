import { type Action } from "@/lib/solar-core";
import { bridge, getWorkspaceSnapshot, publicShowcase } from "@/lib/solar-data";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

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
    return reply(await getWorkspaceSnapshot());
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
  if (publicShowcase()) {
    return reply({ error: "This public showcase is read-only." }, 403);
  }

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
