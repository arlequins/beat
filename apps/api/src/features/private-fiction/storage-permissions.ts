export const PRIVATE_FICTION_OBJECT_KEYS = [
  "author-vault/reality-error/outline.md",
  "author-vault/reality-error/annotations.json",
] as const;

export function privateFictionStoragePermissions<T>(
  objectArn: (key: string) => T,
) {
  return [
    {
      actions: ["s3:GetObject", "s3:PutObject"],
      resources: PRIVATE_FICTION_OBJECT_KEYS.map(objectArn),
    },
  ];
}
