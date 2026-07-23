"use client";

import { Button } from "@acme/ui/button";
import { PenLine } from "lucide-react";
import Link from "next/link";

import {
  Permission,
  PermissionGate,
} from "~/components/authorization/permission-gate";

export function CreateContentButton() {
  return (
    <PermissionGate
      fallback={
        <Button disabled>
          <PenLine />
          Sign in to create
        </Button>
      }
      permission={Permission.POST_WRITE}
    >
      <Button asChild>
        <Link href="/editor/">
          <PenLine />
          New item
        </Link>
      </Button>
    </PermissionGate>
  );
}
