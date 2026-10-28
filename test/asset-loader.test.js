import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { gzipSync, gunzipSync } from 'node:zlib';
import { AssetLoader } from '../src/asset-loader.js';
import { ASSETS } from '../src/asset-manifest.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
function setup(content = Buffer.from('complete sound')) {
  const asset = { path: 'audio/test.wav', bytes: content.length, hash: hash(content), compressed: 'audio/optimized/test.gz', downloadBytes: gzipSync(content).length };
  const entries = new Map();
  const cache = { match: async key => entries.get(key)?.clone(), put: async (key, response) => entries.set(key, response), delete: async key => entries.delete(key), keys: async () => [] };
  let requests = 0, fail = false;
  const loader = new AssetLoader({ assets: [asset], storage: { open: async () => cache }, fetchFile: async () => {
    requests++;
    if (fail) return new Response('missing', { status: 404 });
    return new Response(gzipSync(content));
  } });
  return { loader, asset, entries, cache, get requests() { return requests; }, fail: value => { fail = value; } };
}

test('preloading decompresses exact audio bytes, shares concurrent requests, and reuses persistent cache', async () => {
  const state = setup();
  const progress = [];
  const [a, b] = await Promise.all([state.loader.load(state.asset), state.loader.load(state.asset)]);
  assert.equal(a, b);
  assert.equal(state.requests, 1);
  await state.loader.preload((done, total) => progress.push([done, total]));
  assert.deepEqual(progress.at(-1), [state.asset.downloadBytes, state.asset.downloadBytes]);
  assert.equal(await (await state.loader.fetchAudio('/audio/test.wav?v=1')).text(), 'complete sound');
  state.loader.blobs.clear();
  state.fail(true);
  await state.loader.load(state.asset);
  assert.equal(state.requests, 1);
});

test('failed and corrupt assets block completion and can be retried without downloading successful files again', async () => {
  const state = setup();
  state.fail(true);
  await assert.rejects(state.loader.preload(), /could not load/);
  assert.equal(state.loader.blobs.size, 0);
  state.fail(false);
  await state.loader.preload();
  state.loader.blobs.clear();
  await state.cache.put(state.loader.url(state.asset), new Response('corrupt sound!'));
  await assert.rejects(state.loader.load(state.asset), /Invalid asset/);
  assert.equal(state.entries.size, 0);
  await state.loader.preload();
  assert.equal(state.requests, 3);
});

test('delivery manifest verifies every asset and compressed WAVs retain exact samples and loop lengths', async () => {
  for (const asset of ASSETS) {
    const bytes = await readFile(new URL(`../public/${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes, asset.path);
    assert.equal(hash(bytes), asset.hash, asset.path);
    if (asset.compressed) {
      const compressed = await readFile(new URL(`../public/${asset.compressed}`, import.meta.url));
      assert.equal(compressed.length, asset.downloadBytes);
      assert.deepEqual(gunzipSync(compressed), bytes);
    }
  }
  assert.equal(ASSETS.filter(asset => asset.path.endsWith('.webp')).length, 10);
  assert.ok(ASSETS.filter(asset => asset.path.endsWith('.webp')).reduce((sum, asset) => sum + asset.bytes, 0) < 1_200_000);
});

test('hosts that already decompress HTTP gzip are not decompressed a second time', async () => {
  const content = Buffer.from('already decoded by fetch');
  const state = setup(content);
  state.loader.fetchNetwork = async () => new Response(content, { headers: { 'Content-Encoding': 'gzip' } });
  assert.equal(await (await state.loader.fetchAudio('/audio/test.wav')).text(), content.toString());
});
