import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const integrationKeys = [
  "SOLAR_APPS_SCRIPT_URL",
  "SOLAR_AUTOMATION_TOKEN",
  "SOLAR_OPERATOR_EMAIL",
  "SOLAR_PUBLIC_SHOWCASE",
];

const originalEnvironment = Object.fromEntries(
  integrationKeys.map((key) => [key, process.env[key]]),
);

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;

  for (const key of integrationKeys) {
    const originalValue = originalEnvironment[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

const entryPoint = fileURLToPath(
  new URL("../app/api/workspace/route.ts", import.meta.url),
);

const bundle = await build({
  entryPoints: [entryPoint],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});

const encodedModule = Buffer.from(
  bundle.outputFiles[0].text,
).toString("base64");

const { GET, POST } = await import(
  `data:text/javascript;base64,${encodedModule}`
);

const origin = "https://solar.example";
const endpoint = `${origin}/api/workspace`;

function configureIntegration() {
  process.env.SOLAR_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/example/exec";
  process.env.SOLAR_AUTOMATION_TOKEN = "test-token";
  process.env.SOLAR_OPERATOR_EMAIL = "operator@example.com";
  delete process.env.SOLAR_PUBLIC_SHOWCASE;
}

function postRequest(data, requestOrigin = origin) {
  return new Request(endpoint, {
    method: "POST",
    headers: {
      origin: requestOrigin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

test("private workspace fails closed without integration values", async () => {
  delete process.env.SOLAR_APPS_SCRIPT_URL;
  delete process.env.SOLAR_AUTOMATION_TOKEN;

  const response = await GET();

  assert.equal(response.status, 503);
  assert.match(
    (await response.json()).error,
    /not configured/i,
  );
});

test("workspace snapshot is read only from the Sheets bridge", async () => {
  configureIntegration();

  globalThis.fetch = async (url, options) => {
    assert.equal(
      url,
      "https://script.google.com/macros/s/example/exec",
    );
    assert.equal(options.method, "POST");

    const body = JSON.parse(options.body);

    assert.equal(body.token, "test-token");
    assert.equal(body.type, "snapshot");

    return Response.json({
      ok: true,
      state: {
        version: 7,
        leads: [],
      },
    });
  };

  const response = await GET();
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.mode, "sheets");
  assert.equal(result.state.version, 7);
});

test("POST enforces same-origin requests", async () => {
  configureIntegration();

  const response = await POST(
    postRequest({}, "https://unrelated.example"),
  );

  assert.equal(response.status, 403);
});

test("approved actions are forwarded with the private operator", async () => {
  configureIntegration();

  let forwardedBody;

  globalThis.fetch = async (_url, options) => {
    forwardedBody = JSON.parse(options.body);

    return Response.json({
      ok: true,
      state: {
        version: 8,
      },
    });
  };

  const response = await POST(
    postRequest({
      type: "update_lead",
      request_id: "private-api-test-1",
      expected_version: 7,
      payload: {
        lead_id: "SEPC-TEST",
        lead_status: "Qualified",
      },
    }),
  );

  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.mode, "sheets");
  assert.equal(forwardedBody.token, "test-token");
  assert.equal(forwardedBody.actor, "operator@example.com");
  assert.equal(forwardedBody.type, "update_lead");
});

test("public showcase remains readable but blocks workspace changes", async () => {
  configureIntegration();
  process.env.SOLAR_PUBLIC_SHOWCASE = "Yes";

  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.type, "snapshot");

    return Response.json({
      ok: true,
      state: { version: 9, leads: [] },
    });
  };

  const snapshot = await GET();
  const snapshotBody = await snapshot.json();

  assert.equal(snapshot.status, 200);
  assert.equal(snapshotBody.mode, "showcase");

  const write = await POST(
    postRequest({
      type: "update_lead",
      request_id: "showcase-write-attempt",
      expected_version: 9,
      payload: { lead_id: "SEPC-TEST" },
    }),
  );

  assert.equal(write.status, 403);
  assert.match((await write.json()).error, /read-only/i);
});

test("worker-only actions remain unavailable to the browser", async () => {
  configureIntegration();

  globalThis.fetch = async () => {
    throw new Error("The bridge must not be called.");
  };

  const response = await POST(
    postRequest({
      type: "claim_delivery",
      request_id: "blocked-worker-action",
      expected_version: 7,
      payload: {
        kind: "email",
      },
    }),
  );

  assert.equal(response.status, 400);
});