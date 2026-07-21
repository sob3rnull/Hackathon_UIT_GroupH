"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, Plus, Trash2 } from "lucide-react";
import { project } from "@/config/project";
import { itemStatuses, type ApiResult, type Item, type ItemStatus } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/states";

const { singular, plural, singularLower, pluralLower } = project.entity;

const statusTone: Record<ItemStatus, "neutral" | "accent" | "success"> = {
  new: "neutral",
  active: "accent",
  done: "success",
};

/**
 * The working end-to-end slice: create → list → delete.
 * Keep the shape, swap the fields for whatever the topic needs.
 */
export function Workspace() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/items");
      const result: ApiResult<Item[]> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setItems(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id)); // optimistic
    const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!response.ok) setItems(previous);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
      <CreateForm onCreated={(item) => setItems((current) => [item, ...current])} />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{plural}</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${items.length} total`}
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>

        <CardBody className="flex flex-col gap-3">
          {error ? <ErrorState message={error} onRetry={load} /> : null}

          {loading ? (
            <Skeleton />
          ) : items.length === 0 && !error ? (
            <EmptyState
              icon={<Inbox className="size-6" />}
              title={`No ${pluralLower} yet`}
              body={`Add your first ${singularLower} with the form on the left.`}
            />
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="group flex items-start gap-3 rounded-card border border-border bg-surface-muted/50 p-4 transition-colors hover:border-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{item.title}</h3>
                    <Badge tone={statusTone[item.status] ?? "neutral"}>
                      {item.status}
                    </Badge>
                  </div>
                  {item.notes ? (
                    <p className="mt-1 text-sm text-muted">{item.notes}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">{timeAgo(item.created_at)}</p>
                </div>

                <button
                  onClick={() => remove(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className={cn(
                    "rounded-md p-2 text-muted transition-all",
                    "hover:bg-danger/12 hover:text-danger",
                    "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <Trash2 className="size-4" />
                </button>
              </article>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function CreateForm({ onCreated }: { onCreated: (item: Item) => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ItemStatus>("new");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notes, status }),
      });
      const result: ApiResult<Item> = await response.json();
      if (!result.ok) throw new Error(result.error);

      onCreated(result.data);
      setTitle("");
      setNotes("");
      setStatus("new");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="lg:sticky lg:top-20">
      <CardHeader>
        <CardTitle>New {singularLower}</CardTitle>
        <CardDescription>Posts to /api/items.</CardDescription>
      </CardHeader>

      <CardBody>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`Name this ${singularLower}`}
              required
              maxLength={140}
            />
          </Field>

          <Field label="Notes" htmlFor="notes" hint="Optional.">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Any detail worth keeping"
            />
          </Field>

          <Field label="Status" htmlFor="status">
            <Select
              id="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ItemStatus)}
            >
              {itemStatuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          {error ? <ErrorState message={error} /> : null}

          <Button type="submit" disabled={submitting || !title.trim()}>
            {submitting ? <Spinner /> : <Plus className="size-4" />}
            {submitting ? "Saving…" : `Add ${singular.toLowerCase()}`}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
