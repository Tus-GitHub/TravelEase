import assert from "node:assert/strict";
import { imageFormat, MAX_IMAGE_BYTES } from "../../src/lib/image-upload.ts";
import { uploadImage, imageStorageReady, signCloudinary } from "../../src/lib/server/cloudinary.ts";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
try {
  delete process.env.CLOUDINARY_CLOUD_NAME;
  assert.equal(imageStorageReady(), false);
  await assert.rejects(() => uploadImage(new File(["x"], "x.png")), /not configured/);
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  assert.equal(imageStorageReady(), true);
  assert.equal(imageFormat(new TextEncoder().encode("<svg></svg>")), null);
  assert.equal(imageFormat(new Uint8Array([255, 216, 255])), "jpg");
  assert.equal(imageFormat(new TextEncoder().encode("RIFFxxxxWEBP")), "webp");
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const body = options?.body as FormData;
    assert.equal(body.get("api_key"), "test-key");
    const params: Record<string, string> = {};
    body.forEach((value, key) => { if (!["file", "api_key", "signature"].includes(key)) params[key] = String(value); });
    assert.equal(body.get("signature"), signCloudinary(params, "test-secret"));
    assert.equal(body.get("allowed_formats"), "jpg,png,webp");
    assert.equal(body.get("overwrite"), "false");
    return Response.json({ public_id: body.get("public_id"), secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${body.get("public_id")}.webp` });
  };
  await assert.rejects(() => uploadImage(new File(["<svg/>"], "fake.png", { type: "image/png" })), /valid JPEG/);
  await assert.rejects(() => uploadImage(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.png", { type: "image/png" })), /3 MB/);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(() => uploadImage(new File([png], "wrong.jpg", { type: "image/jpeg" })), /valid JPEG/);
  assert.equal(calls, 0, "invalid files never reach provider");
  const saved = await uploadImage(new File([png], "safe.png", { type: "image/png" }));
  assert.match(saved.url, /^https:\/\/res.cloudinary.com\/test-cloud\/image\/upload\//);
  assert.equal(calls, 1);
  globalThis.fetch = async () => Response.json({ error: "provider details" }, { status: 400 });
  await assert.rejects(() => uploadImage(new File([png], "safe.png", { type: "image/png" })), /storage rejected/);
  globalThis.fetch = async () => Response.json({ public_id: "wrong", secure_url: "https://evil.test/a.png" });
  await assert.rejects(() => uploadImage(new File([png], "safe.png", { type: "image/png" })), /invalid response/);
  console.log("Image upload validation and provider contract checks passed (mocked provider, no external uploads).");
} finally {
  globalThis.fetch = originalFetch;
  for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
    if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key];
  }
}
