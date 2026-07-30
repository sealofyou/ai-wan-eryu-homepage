import * as THREE from "three";
import { disposeObjectGraph } from "./renderer";

export type DesktopMouseVariant = "procedural" | "glb";

export const DESKTOP_MODEL_URLS = {
  mouse: "/models/desktop/gaming-mouse.glb",
} as const;

export const resolveDesktopMouseVariant = (
  search: string,
): DesktopMouseVariant =>
  new URLSearchParams(search).get("mouse") === "glb" ? "glb" : "procedural";

export interface GlbModelLease {
  scene: THREE.Group;
  release: () => void;
}

export interface GlbAcquireOptions {
  signal?: AbortSignal;
}

export interface GlbAssetStore {
  acquire: (url: string, options?: GlbAcquireOptions) => Promise<GlbModelLease>;
}

interface GlbAssetStoreOptions {
  loadBytes?: (url: string, signal?: AbortSignal) => Promise<ArrayBuffer>;
  parse?: (bytes: ArrayBuffer, resourcePath: string) => Promise<THREE.Group>;
  dispose?: (root: THREE.Object3D) => void;
}

interface ByteCacheEntry {
  bytes: Promise<ArrayBuffer>;
  controller: AbortController;
  references: number;
}

const loadModelBytes = async (url: string, signal?: AbortSignal) => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Unable to load desktop model (${response.status}): ${url}`);
  }
  return response.arrayBuffer();
};

const abortReasonFor = (signal: AbortSignal) =>
  signal.reason ?? new DOMException("Aborted", "AbortError");

const raceWithAbort = <T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortReasonFor(signal));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortReasonFor(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
};

const resourcePathFor = (url: string) => {
  const separator = url.lastIndexOf("/");
  return separator >= 0 ? url.slice(0, separator + 1) : "";
};

export const createGlbAssetStore = (
  options: GlbAssetStoreOptions = {},
): GlbAssetStore => {
  const loadBytes = options.loadBytes ?? loadModelBytes;
  const parse =
    options.parse ??
    (async (bytes: ArrayBuffer, resourcePath: string) => {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const gltf = await loader.parseAsync(bytes.slice(0), resourcePath);
      return gltf.scene;
    });
  const dispose = options.dispose ?? disposeObjectGraph;
  const byteCache = new Map<string, ByteCacheEntry>();

  const releaseReference = (url: string, entry: ByteCacheEntry) => {
    entry.references -= 1;
    if (entry.references <= 0 && byteCache.get(url) === entry) {
      byteCache.delete(url);
      entry.controller.abort();
    }
  };

  return {
    acquire: async (url, acquireOptions) => {
      const signal = acquireOptions?.signal;
      if (signal?.aborted) throw abortReasonFor(signal);

      let entry = byteCache.get(url);
      if (!entry) {
        const controller = new AbortController();
        entry = {
          bytes: loadBytes(url, controller.signal),
          controller,
          references: 0,
        };
        byteCache.set(url, entry);
      }
      entry.references += 1;

      let scene: THREE.Group;
      try {
        const bytes = await raceWithAbort(entry.bytes, signal);
        const parsing = parse(bytes, resourcePathFor(url));
        try {
          scene = await raceWithAbort(parsing, signal);
        } catch (error) {
          if (signal?.aborted) {
            void parsing.then(dispose, () => undefined);
          }
          throw error;
        }
      } catch (error) {
        releaseReference(url, entry);
        throw error;
      }

      let released = false;
      return {
        scene,
        release: () => {
          if (released) return;
          released = true;
          dispose(scene);
          releaseReference(url, entry);
        },
      };
    },
  };
};
