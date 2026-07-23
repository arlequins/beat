"use client";

import { getTrpcUserFacingMessage } from "@acme/trpc/client";
import { Button } from "@acme/ui/button";
import { toast } from "@acme/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

export function FileUploadField() {
  const trpc = useTRPC();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedKey, setUploadedKey] = useState<string>();
  const target = useMutation(
    trpc.file.createUpload.mutationOptions({
      onError: (error) => toast.error(getTrpcUserFacingMessage(error)),
    }),
  );

  async function upload(file: File) {
    const result = await target.mutateAsync({
      contentType: file.type || "application/octet-stream",
      fileName: file.name,
      size: file.size,
    });
    const response = await fetch(result.url, {
      body: file,
      headers: { "Content-Type": file.type },
      method: result.method,
    });
    if (!response.ok)
      throw new Error(`Upload failed with HTTP ${response.status}`);
    setUploadedKey(result.key);
    toast.success("File uploaded");
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Attachment</p>
          <p className="text-muted-foreground mt-1 text-xs">
            PNG, JPEG, PDF, or text up to 10 MB
          </p>
        </div>
        <Button
          disabled={target.isPending}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="outline"
        >
          <Upload />
          {target.isPending ? "Uploading" : "Upload"}
        </Button>
      </div>
      <input
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file)
            void upload(file).catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : "Upload failed",
              ),
            );
        }}
        ref={inputRef}
        type="file"
      />
      {uploadedKey && (
        <p className="text-muted-foreground mt-3 flex items-center gap-2 truncate border-t pt-3 text-xs">
          <Paperclip className="size-4 shrink-0" />
          {uploadedKey}
        </p>
      )}
    </div>
  );
}
