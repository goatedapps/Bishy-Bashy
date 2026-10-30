import { ASSETS } from './asset-manifest.js';

const BASE = import.meta.env?.BASE_URL || '/';
const CACHE = 'dokidoki-dash-assets-v1';

export class AssetLoader {
  constructor({ fetchFile = (...args) => fetch(...args), storage = globalThis.caches, decodeImage = async blob => {
    const url = URL.createObjectURL(blob);
    try { const image = new Image(); image.src = url; await image.decode(); }
    finally { URL.revokeObjectURL(url); }
  }, assets = ASSETS } = {}) {
    this.fetchNetwork = fetchFile;
    this.storage = storage;
    this.decodeImage = decodeImage;
    this.assets = assets;
    this.blobs = new Map();
    this.mediaUrls = new Map();
    this.pending = new Map();
  }

  url(asset) {
    if (asset.compressed && typeof DecompressionStream !== 'undefined') return `${BASE}${asset.compressed}`;
    return `${BASE}${asset.path}${asset.path.startsWith('audio/') ? `?v=${asset.hash}` : ''}`;
  }

  async load(asset) {
    if (this.blobs.has(asset.path)) return this.blobs.get(asset.path);
    if (this.pending.has(asset.path)) return this.pending.get(asset.path);
    const promise = (async () => {
      const url = this.url(asset);
      let cache;
      try { cache = await this.storage?.open(CACHE); } catch {}
      let response;
      try { response = await cache?.match(url); } catch {}
      if (!response) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);
        try {
          response = await this.fetchNetwork(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Could not load ${asset.path}`);
          let blob = await response.blob();
          if (asset.compressed && url.endsWith('.gz')) {
            const signature = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
            // Some hosts set Content-Encoding and the browser has already decompressed it.
            if (signature[0] === 31 && signature[1] === 139) blob = await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
          }
          if (blob.size !== asset.bytes) throw new Error(`Incomplete asset: ${asset.path}`);
          response = new Response(blob);
        } finally { clearTimeout(timer); }
        try { await cache?.put(url, response.clone()); } catch {}
      }
      const blob = await response.blob();
      if (blob.size !== asset.bytes) {
        try { await cache?.delete(url); } catch {}
        throw new Error(`Incomplete asset: ${asset.path}`);
      }
      try {
        if (globalThis.crypto?.subtle) {
          const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
          const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
          if (!hash.startsWith(asset.hash)) throw new Error(`Invalid asset: ${asset.path}`);
        }
        if (asset.path.startsWith('assets/')) await this.decodeImage(blob);
      } catch (error) { try { await cache?.delete(url); } catch {} throw error; }
      this.blobs.set(asset.path, blob);
      return blob;
    })();
    this.pending.set(asset.path, promise);
    try { return await promise; }
    finally { this.pending.delete(asset.path); }
  }

  async preload(onProgress = () => {}) {
    const size = asset => asset.downloadBytes && typeof DecompressionStream !== 'undefined' ? asset.downloadBytes : asset.bytes;
    const total = this.assets.reduce((sum, asset) => sum + size(asset), 0);
    let completed = 0, index = 0;
    const failures = [];
    onProgress(0, total);
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (index < this.assets.length && !failures.length) {
        const asset = this.assets[index++];
        try { await this.load(asset); completed += size(asset); onProgress(completed, total); }
        catch { failures.push(asset.path); }
      }
    }));
    if (failures.length) throw new Error(`${failures.length} files could not load. Check your connection and try again.`);
    try {
      const cache = await this.storage?.open(CACHE);
      const current = new Set(this.assets.map(asset => new URL(this.url(asset), location.href).href));
      for (const request of await cache?.keys() || []) if (!current.has(request.url)) await cache.delete(request);
    } catch {}
  }

  async fetchAudio(url, options) {
    const file = url.split('/').at(-1).split('?')[0];
    const asset = this.assets.find(item => item.path === `audio/${file}`);
    return asset ? new Response(await this.load(asset)) : this.fetchNetwork(url, options);
  }

  mediaUrl(file) {
    const path = `audio/${file}`;
    if (!this.blobs.has(path)) return `${BASE}${path}`;
    return this.objectUrl(path);
  }

  objectUrl(path) {
    if (!this.mediaUrls.has(path)) this.mediaUrls.set(path, URL.createObjectURL(this.blobs.get(path)));
    return this.mediaUrls.get(path);
  }

  async applyImages(style) {
    await Promise.all(this.assets.filter(asset => asset.path.startsWith('assets/')).map(async asset => {
      const url = this.objectUrl(asset.path);
      const image = new Image(); image.src = url; await image.decode();
      const name = asset.path.split('/').at(-1).replace(/-[0-9a-f]{12}\.webp$/, '');
      style.setProperty(`--image-${name}`, `url("${url}")`);
    }));
  }
}
