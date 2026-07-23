"use client";

import { getTrpcUserFacingMessage } from "@acme/trpc/client";
import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { Skeleton } from "@acme/ui/skeleton";
import { Textarea } from "@acme/ui/textarea";
import { toast } from "@acme/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Save } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FileUploadField } from "~/components/content/file-upload-field";
import { useTRPC } from "~/trpc/react";

export function PostEditor() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [preview, setPreview] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const existing = useQuery(
    trpc.post.byId.queryOptions({ id: id ?? "" }, { enabled: Boolean(id) }),
  );
  useEffect(() => {
    if (!existing.data) return;
    setTitle(existing.data.title);
    setBody(existing.data.content);
  }, [existing.data]);
  const mutationOptions = {
    onError: (error: unknown) => toast.error(getTrpcUserFacingMessage(error)),
    onSuccess: async () => {
      toast.success(id ? "Item updated" : "Item created");
      await queryClient.invalidateQueries(trpc.post.pathFilter());
      router.push("/posts/");
    },
  };
  const createPost = useMutation(
    trpc.post.create.mutationOptions(mutationOptions),
  );
  const updatePost = useMutation(
    trpc.post.update.mutationOptions(mutationOptions),
  );
  const save = () => {
    const data = { content: body, title };
    if (id && existing.data)
      updatePost.mutate({
        data: { ...data, version: existing.data.version },
        id,
      });
    else createPost.mutate(data);
  };
  const isSaving = createPost.isPending || updatePost.isPending;

  if (id && existing.isPending)
    return <Skeleton className="h-[520px] w-full" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            {id ? "Editing existing content" : "New content item"}
          </p>
          <h1 className="mt-1 text-xl font-semibold">Content editor</h1>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            onClick={() => setPreview((value) => !value)}
            variant="outline"
          >
            <Eye />
            {preview ? "Continue editing" : "Preview"}
          </Button>
          <Button
            disabled={isSaving || !title.trim() || !body.trim()}
            onClick={save}
            variant="outline"
          >
            <Save />
            {isSaving ? "Saving" : "Save item"}
          </Button>
        </div>
      </div>
      {preview ? (
        <article className="bg-background overflow-hidden rounded-lg border shadow-xs">
          <div className="relative aspect-[4/3] sm:aspect-[16/7]">
            <Image
              alt="Workspace with a notebook and laptop"
              className="object-cover"
              fill
              sizes="100vw"
              src="/blog/editorial-workspace.jpg"
            />
          </div>
          <div className="mx-auto max-w-3xl px-6 py-10">
            <p className="text-primary text-sm font-medium">Work</p>
            <h2 className="mt-3 text-3xl font-semibold">
              {title || "Untitled post"}
            </h2>
            <div className="mt-8 space-y-5 leading-8">
              {body.split("\n\n").map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="bg-background space-y-5 rounded-lg border p-4 shadow-xs sm:p-7">
            <label className="block text-sm font-medium" htmlFor="post-title">
              Title
              <Input
                className="mt-2 h-11 text-lg"
                id="post-title"
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="content-body">
              Body
              <Textarea
                className="bg-background mt-2 min-h-80 w-full rounded-md border p-4 font-serif text-base leading-7"
                id="content-body"
                onChange={(event) => setBody(event.target.value)}
                value={body}
              />
            </label>
          </section>
          <aside className="bg-background h-fit rounded-lg border p-5 shadow-xs">
            <h2 className="text-sm font-semibold">Attachments</h2>
            <p className="text-muted-foreground mt-1 text-xs">
              The storage adapter can be replaced without changing this form.
            </p>
            <div className="mt-5">
              <FileUploadField />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
