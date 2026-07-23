"use client";

import { Button } from "@acme/ui/button";
import { Input } from "@acme/ui/input";
import { toast } from "@acme/ui/toast";
import { Save } from "lucide-react";
import { useState } from "react";
import { siteConfig } from "~/config/site";

const tabs = ["General", "Publishing", "Security"] as const;

function Toggle(props: {
  defaultChecked?: boolean;
  description: string;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 border-b py-4 last:border-0">
      <span>
        <span className="block text-sm font-medium">{props.label}</span>
        <span className="text-muted-foreground mt-1 block text-xs">
          {props.description}
        </span>
      </span>
      <input
        className="mt-1 size-4 accent-pink-600"
        defaultChecked={props.defaultChecked}
        type="checkbox"
      />
    </label>
  );
}

export function AdminSettings() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("General");
  return (
    <div className="bg-background rounded-lg border shadow-xs">
      <div
        className="grid grid-cols-3 border-b px-2 sm:flex sm:px-4"
        role="tablist"
      >
        {tabs.map((item) => (
          <button
            aria-selected={tab === item}
            className={`h-12 border-b-2 px-2 text-sm font-medium sm:px-4 ${tab === item ? "border-primary text-foreground" : "text-muted-foreground border-transparent"}`}
            key={item}
            onClick={() => setTab(item)}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="max-w-3xl p-5 sm:p-7">
        {tab === "General" && (
          <div className="space-y-5">
            <label
              className="block text-sm font-medium"
              htmlFor="publication-name"
            >
              Publication name
              <Input
                className="mt-2"
                defaultValue={siteConfig.name}
                id="publication-name"
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="site-url">
              Site URL
              <Input
                className="mt-2"
                defaultValue="https://app.example.com"
                id="site-url"
              />
            </label>
            <label className="block text-sm font-medium">
              Description
              <textarea
                className="bg-background mt-2 min-h-28 w-full rounded-md border p-3 text-sm"
                defaultValue="Independent ideas for thoughtful teams."
              />
            </label>
          </div>
        )}
        {tab === "Publishing" && (
          <div>
            <Toggle
              defaultChecked
              description="Allow readers to join conversations on published posts."
              label="Enable comments"
            />
            <Toggle
              defaultChecked
              description="Hold first-time contributors for editorial review."
              label="Moderate new contributors"
            />
            <Toggle
              description="Send subscribers an email when a post is published."
              label="Automatic newsletters"
            />
          </div>
        )}
        {tab === "Security" && (
          <div>
            <div className="border-b pb-5">
              <h2 className="text-sm font-semibold">OpenID Connect</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Authentication is configured through the environment and uses
                PKCE for browser clients.
              </p>
              <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                Connected
              </span>
            </div>
            <Toggle
              defaultChecked
              description="Require a fresh sign-in for sensitive administration changes."
              label="Reauthentication"
            />
            <Toggle
              defaultChecked
              description="Record role and access changes in the audit log."
              label="Audit access changes"
            />
          </div>
        )}
        <div className="mt-7 flex justify-end border-t pt-5">
          <Button
            className="w-full sm:w-auto"
            onClick={() => toast.success("Settings saved")}
          >
            <Save />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
