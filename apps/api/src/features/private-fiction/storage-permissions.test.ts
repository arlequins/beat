import { describe, expect, it } from "vitest";
import {
  PRIVATE_FICTION_OBJECT_KEYS,
  privateFictionStoragePermissions,
} from "./storage-permissions";

describe("private fiction storage permissions", () => {
  it("allows direct reads and writes only to the two private objects", () => {
    const permissions = privateFictionStoragePermissions(
      (key) => `arn:aws:s3:::private-vault/${key}`,
    );

    expect(permissions).toEqual([
      {
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: PRIVATE_FICTION_OBJECT_KEYS.map(
          (key) => `arn:aws:s3:::private-vault/${key}`,
        ),
      },
    ]);
    expect(permissions.flatMap(({ actions }) => actions)).not.toContain(
      "s3:DeleteObject",
    );
    expect(permissions.flatMap(({ actions }) => actions)).not.toContain(
      "s3:ListBucket",
    );
    expect(permissions.flatMap(({ resources }) => resources)).not.toContain(
      "arn:aws:s3:::private-vault/*",
    );
  });
});
