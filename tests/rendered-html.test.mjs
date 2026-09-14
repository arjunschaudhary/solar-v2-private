import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("emits a valid Vercel Build Output API bundle", async () => {
  const output = new URL("../.vercel/output/", import.meta.url);
  const config = JSON.parse(
    await readFile(new URL("config.json", output), "utf8"),
  );

  assert.equal(config.version, 3);

  await access(
    new URL("functions/__server.func/index.mjs", output),
  );

  const assets = await readdir(new URL("static/assets/", output));

  assert.ok(assets.some((name) => name.endsWith(".css")));
  assert.ok(
    assets.some(
      (name) => name.startsWith("workspace-") && name.endsWith(".js"),
    ),
  );
});