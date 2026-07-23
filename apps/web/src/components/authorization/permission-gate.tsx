"use client";

import type { Permission as PermissionType } from "@acme/auth/authorization";
import { hasPermission, Permission } from "@acme/auth/authorization";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "~/auth/provider";
import { useTRPC } from "~/trpc/react";

export { Permission };

export function PermissionGate(props: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  permission: PermissionType;
}) {
  const { user } = useAuth();
  const trpc = useTRPC();
  const session = useQuery(
    trpc.auth.me.queryOptions(undefined, {
      enabled: Boolean(user),
      retry: false,
    }),
  );
  if (!session.data || !hasPermission(session.data.roles, props.permission))
    return props.fallback ?? null;
  return props.children;
}
