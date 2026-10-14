import assert from "node:assert/strict";

import { readArchived, type PackageCheck } from "./shared.js";

export const drizzle: PackageCheck = {
  assertArchive({ archive, entries, manifest, packed }) {
    assert.ok(![...entries].some((entry) => entry.startsWith("package/docs/")));
    assert.ok(![...entries].some((entry) => entry.startsWith("package/dist/pg/")));
    assert.ok(!Object.hasOwn(packed.exports, "./pg"));
    assert.equal(packed.peerDependencies?.postgres, "3.4.9");
    assert.equal(packed.peerDependenciesMeta?.postgres?.optional, true);
    // Adapted upstream code must ship its complete notices and licenses.
    assert.ok(manifest.files?.includes("NOTICE.md"), `${packed.name}: NOTICE.md must be published`);
    const notices = readArchived(archive, "NOTICE.md");
    const license = readArchived(archive, "LICENSE");
    assert.ok(notices.includes("Copyright (c) Alec Larson"));
    assert.ok(notices.includes("Permission is hereby granted, free of charge"));
    assert.ok(license.includes("Copyright 2026 Hiago Almeida"));
    assert.ok(license.includes("END OF TERMS AND CONDITIONS"));
  },
};
