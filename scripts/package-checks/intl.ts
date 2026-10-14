import assert from "node:assert/strict";

import type { PackageCheck } from "./shared.js";

export const intl: PackageCheck = {
  assertArchive({ packed }) {
    assert.equal(packed.dependencies?.["use-intl"], "4.14.9");
    assert.equal(packed.peerDependencies?.react, "^19.0.0");
    assert.notEqual(packed.peerDependenciesMeta?.react?.optional, true);
    assert.ok(!Object.hasOwn(packed.dependencies ?? {}, "intl-messageformat"));
  },
  consumerDependencies({ packed }) {
    const react = packed.peerDependencies?.react;
    assert.ok(react, `${packed.name}: missing React peer`);
    return { "react-dom": react };
  },
  consumerDevDependencies({ manifest }) {
    const types = manifest.devDependencies?.["@types/react"];
    const domTypes = manifest.devDependencies?.["@types/react-dom"];
    assert.ok(types && domTypes, `${manifest.name}: missing React type packages`);
    return { "@types/react": types, "@types/react-dom": domTypes };
  },
};
