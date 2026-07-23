"use client";

import type { RouterOutputs } from "@acme/trpc/client";
import { getTrpcUserFacingMessage } from "@acme/trpc/client";
import { Alert } from "@acme/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@acme/ui/alert-dialog";
import { Button } from "@acme/ui/button";
import { EmptyState } from "@acme/ui/empty-state";
import { Input } from "@acme/ui/input";
import { Pagination } from "@acme/ui/pagination";
import { Select } from "@acme/ui/select";
import { Skeleton } from "@acme/ui/skeleton";
import { toast } from "@acme/ui/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  Permission,
  PermissionGate,
} from "~/components/authorization/permission-gate";
import { useTRPC } from "~/trpc/react";

type PostItem = RouterOutputs["post"]["all"]["items"][number];

function ContentRow(props: { item: PostItem; onDelete: (id: string) => void }) {
  return (
    <article className="flex items-start gap-3 p-4">
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold">{props.item.title}</h2>
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
          {props.item.content}
        </p>
        <p className="text-muted-foreground mt-2 text-xs">
          Updated{" "}
          {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
            props.item.updatedAt ?? props.item.createdAt,
          )}
        </p>
      </div>
      <PermissionGate permission={Permission.POST_WRITE}>
        <div className="flex shrink-0">
          <Button
            asChild
            aria-label={`Edit ${props.item.title}`}
            size="icon"
            variant="ghost"
          >
            <Link href={`/editor/?id=${props.item.id}`}>
              <Pencil />
            </Link>
          </Button>
          <Button
            aria-label={`Delete ${props.item.title}`}
            onClick={() => props.onDelete(props.item.id)}
            size="icon"
            variant="ghost"
          >
            <Trash2 />
          </Button>
        </div>
      </PermissionGate>
    </article>
  );
}

export function ContentList() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"createdAt" | "title">("createdAt");
  const input = { direction: "desc" as const, page, pageSize: 10, query, sort };
  const posts = useQuery(trpc.post.all.queryOptions(input));
  const deletePost = useMutation(
    trpc.post.delete.mutationOptions({
      onError: (error) => toast.error(getTrpcUserFacingMessage(error)),
      onSuccess: async () => {
        setPendingDeleteId(undefined);
        toast.success("Item deleted");
        await queryClient.invalidateQueries(trpc.post.pathFilter());
      },
    }),
  );

  return (
    <section className="bg-background overflow-hidden rounded-lg border shadow-xs">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
        <label className="relative flex-1" htmlFor="content-search">
          <span className="sr-only">Search content</span>
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            className="pl-9"
            id="content-search"
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Search title or content"
            value={query}
          />
        </label>
        <Select
          aria-label="Sort content"
          className="sm:w-44"
          onChange={(event) => setSort(event.target.value as typeof sort)}
          value={sort}
        >
          <option value="createdAt">Recently updated</option>
          <option value="title">Title</option>
        </Select>
      </div>
      {posts.isPending && (
        <div className="space-y-1 p-4">
          {[1, 2, 3].map((key) => (
            <Skeleton className="h-20" key={key} />
          ))}
        </div>
      )}
      {posts.isError && (
        <div className="p-4">
          <Alert variant="destructive">
            {getTrpcUserFacingMessage(posts.error)}{" "}
            <Button
              className="ml-2"
              onClick={() => posts.refetch()}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </Alert>
        </div>
      )}
      {posts.data?.items.length === 0 && (
        <EmptyState
          description="Create the first item or change the current search."
          icon={FileText}
          title="No content found"
        />
      )}
      {posts.data && posts.data.items.length > 0 && (
        <div className="divide-y">
          {posts.data.items.map((item) => (
            <ContentRow
              item={item}
              key={item.id}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}
      <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-3 text-xs">
        <span>{posts.data?.total ?? 0} items</span>
        <Pagination
          onPageChange={setPage}
          page={page}
          pageSize={posts.data?.pageSize ?? 10}
          total={posts.data?.total ?? 0}
        />
      </div>
      <AlertDialog
        onOpenChange={(open) => !open && setPendingDeleteId(undefined)}
        open={Boolean(pendingDeleteId)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete this item?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePost.isPending}
              onClick={() => {
                if (pendingDeleteId) deletePost.mutate(pendingDeleteId);
              }}
            >
              {deletePost.isPending ? "Deleting" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
