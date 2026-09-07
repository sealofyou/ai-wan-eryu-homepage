import { describe, expect, it } from "vitest";
import * as THREE from "../src/desktop/core/three-build-core.mjs";
import { readFileSync } from "node:fs";

const requiredBuildExports = [
  "UniformsUtils",
  "mergeUniforms",
  "cloneUniforms",
  "getUnlitUniformColorSpace",
  "ReversedDepthFuncs",
  "createElementNS",
  "probeAsync",
  "getByteLength",
  "RAD2DEG",
];

describe("Three build core facade", () => {
  it("satisfies the actual installed renderer import contract on dependency upgrades", () => {
    const source = readFileSync(new URL("../node_modules/three/build/three.module.js", import.meta.url), "utf8");
    const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']\.\/three\.core\.js["']/g)];
    expect(imports.length).toBeGreaterThan(0);
    const required = imports.flatMap(match => match[1].split(",").map(part => part.trim().split(/\s+as\s+/)[0]));
    for (const name of required) expect(THREE[name], name).not.toBeUndefined();
  });
  it("keeps the build internals required by three.module.js available", () => {
    for (const exportName of requiredBuildExports) {
      expect(THREE[exportName], exportName).not.toBeUndefined();
    }
  });

  it("keeps core desktop scene exports available without the legacy extras layer", () => {
    expect(THREE.Scene).toBeTypeOf("function");
    expect(THREE.MeshStandardMaterial).toBeTypeOf("function");
  });
});
