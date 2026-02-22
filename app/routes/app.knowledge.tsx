/**
 * Knowledge Base page — merchant admin
 *
 * Shows all KB entries stored in the DB for this shop.
 * Merchants can:
 *   - See policies auto-imported from Shopify on install
 *   - Re-import policies at any time (pulls fresh from Shopify)
 *   - Add custom FAQs / entries
 *   - Toggle active/draft status
 *   - Delete entries
 */
import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { BookOpen, Plus, Pencil, Trash2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "~/db.server";
import { importStorePolicies } from "~/lib/importStorePolicies.server";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KbEntry {
  id: string;
  title: string;
  content: string;
  type: string;
  status: string;
  source: string;
  updatedAt: string;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const entries = await prisma.knowledgeBase.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      status: true,
      source: true,
      updatedAt: true,
    },
  });

  return {
    entries: entries.map((e) => ({
      ...e,
      updatedAt: e.updatedAt.toISOString(),
    })) as KbEntry[],
    hasImported: entries.some((e) => e.source === "shopify_import"),
  };
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // ── Re-import from Shopify ────────────────────────────────────────────────
  if (intent === "import_policies") {
    console.log(`[KB] Import triggered by merchant for shop: ${shop}`);
    try {
      const result = await importStorePolicies(shop, admin);
      console.log(`[KB] Import result: imported=${result.imported} skipped=${result.skipped} errors=${JSON.stringify(result.errors)}`);

      if (result.errors.length > 0) {
        return {
          ok: false,
          message: `Import encountered errors: ${result.errors.join("; ")}`,
          imported: result.imported,
          errors: result.errors,
        };
      }

      return {
        ok: true,
        message:
          result.imported > 0
            ? `✓ Imported ${result.imported} polic${result.imported === 1 ? "y" : "ies"} from your store.`
            : result.skipped > 0
            ? "⚠️ Your Shopify policies exist but have no content yet. Go to Shopify Settings → Policies to add content, then re-import."
            : "⚠️ No policies found in your Shopify store. Set them up at Shopify Settings → Policies first.",
        imported: result.imported,
        errors: result.errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[KB] Import failed with exception:`, err);
      return {
        ok: false,
        message: `Import failed: ${msg}`,
        imported: 0,
        errors: [msg],
      };
    }
  }

  // ── Add new entry ─────────────────────────────────────────────────────────
  if (intent === "add_entry") {
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    if (!title || !content) {
      return { ok: false, message: "Title and content are required." };
    }
    await prisma.knowledgeBase.create({
      data: { shop, title, content, type: "custom", status: "active", source: "manual" },
    });
    return { ok: true, message: `✓ "${title}" added to Knowledge Base.` };
  }

  // ── Toggle status ─────────────────────────────────────────────────────────
  if (intent === "toggle_status") {
    const id = formData.get("id") as string;
    const current = formData.get("status") as string;
    await prisma.knowledgeBase.update({
      where: { id },
      data: { status: current === "active" ? "draft" : "active" },
    });
    return { ok: true };
  }

  // ── Delete entry ──────────────────────────────────────────────────────────
  if (intent === "delete_entry") {
    const id = formData.get("id") as string;
    await prisma.knowledgeBase.delete({ where: { id } });
    return { ok: true, message: "Entry deleted." };
  }

  // ── Update entry ──────────────────────────────────────────────────────────
  if (intent === "update_entry") {
    const id = formData.get("id") as string;
    const title = (formData.get("title") as string)?.trim();
    const content = (formData.get("content") as string)?.trim();
    if (!title || !content) {
      return { ok: false, message: "Title and content are required." };
    }
    await prisma.knowledgeBase.update({ where: { id }, data: { title, content } });
    return { ok: true, message: `✓ "${title}" updated.` };
  }

  return { ok: false, message: "Unknown action." };
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const { entries, hasImported } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{
    ok: boolean;
    message?: string;
    imported?: number;
    errors?: string[];
  }>();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const selected = entries.find((e) => e.id === selectedId);
  const isSubmitting = fetcher.state !== "idle";

  const lastMessage = fetcher.data?.message ?? "";
  const lastOk = fetcher.data?.ok;

  function handleImport() {
    const fd = new FormData();
    fd.append("intent", "import_policies");
    fetcher.submit(fd, { method: "post" });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;
    const fd = new FormData();
    fd.append("intent", "delete_entry");
    fd.append("id", id);
    fetcher.submit(fd, { method: "post" });
    if (selectedId === id) setSelectedId(null);
  }

  function handleToggle(id: string, status: string) {
    const fd = new FormData();
    fd.append("intent", "toggle_status");
    fd.append("id", id);
    fd.append("status", status);
    fetcher.submit(fd, { method: "post" });
  }

  const sourceLabel = (s: string) =>
    s === "shopify_import" ? "Shopify" : "Manual";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Knowledge Base</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Policies and FAQs your AI can reference when answering customer questions
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleImport}
            disabled={isSubmitting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8,
              border: "1px solid #d1d5db", background: "#fff",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              color: "#374151", opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} />
            {hasImported ? "Re-import from Shopify" : "Import from Shopify"}
          </button>
          <button
            onClick={() => { setShowAddForm(true); setSelectedId(null); setEditing(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8,
              background: "#008060", color: "#fff",
              border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> Add Entry
          </button>
        </div>
      </div>

      {/* Status message */}
      {lastMessage && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 8,
            background: lastOk ? "hsl(160 100% 96%)" : "#fff7ed",
            border: `1px solid ${lastOk ? "#008060" : "#f97316"}`,
            fontSize: 13, color: lastOk ? "#004c3f" : "#c2410c",
          }}
        >
          {lastOk ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {lastMessage}
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !showAddForm && (
        <div
          style={{
            textAlign: "center", padding: "48px 24px",
            border: "2px dashed #e5e7eb", borderRadius: 12,
          }}
        >
          <BookOpen size={32} style={{ margin: "0 auto 12px", color: "#9ca3af" }} />
          <p style={{ fontWeight: 600, fontSize: 15, color: "#374151", margin: "0 0 6px" }}>
            No knowledge base entries yet
          </p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
            Import your store's policies from Shopify automatically, or add custom FAQs.
          </p>
          <button
            onClick={handleImport}
            disabled={isSubmitting}
            style={{
              padding: "8px 20px", borderRadius: 8,
              background: "#008060", color: "#fff",
              border: "none", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isSubmitting ? "Importing…" : "Import Policies from Shopify"}
          </button>
        </div>
      )}

      {/* Main grid — list + detail */}
      {(entries.length > 0 || showAddForm) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Entry list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => { setSelectedId(entry.id); setEditing(false); setShowAddForm(false); }}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "12px 14px", borderRadius: 10,
                  border: `1px solid ${selectedId === entry.id ? "#008060" : "#e5e7eb"}`,
                  background: selectedId === entry.id ? "hsl(160 100% 96%)" : "#fff",
                  cursor: "pointer", transition: "border-color .12s, background .12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <BookOpen size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry.title}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 999,
                      background: entry.status === "active" ? "hsl(160 100% 90%)" : "#f3f4f6",
                      color: entry.status === "active" ? "#004c3f" : "#6b7280", fontWeight: 500,
                    }}>
                      {entry.status}
                    </span>
                    <span style={{
                      fontSize: 11, padding: "2px 7px", borderRadius: 999,
                      background: "#f3f4f6", color: "#6b7280", fontWeight: 500,
                    }}>
                      {sourceLabel(entry.source)}
                    </span>
                  </div>
                </div>
                <p style={{
                  fontSize: 12, color: "#6b7280", margin: "6px 0 0",
                  overflow: "hidden", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}>
                  {entry.content.slice(0, 120)}{entry.content.length > 120 ? "…" : ""}
                </p>
              </button>
            ))}
          </div>

          {/* Detail / Edit / Add panel */}
          <div className="polaris-card">
            {/* Add form */}
            {showAddForm && (
              <fetcher.Form method="post" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="hidden" name="intent" value="add_entry" />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Add New Entry</h3>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Title</label>
                  <input
                    name="title" placeholder="e.g. Size Guide" required
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box" as const }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Content</label>
                  <textarea
                    name="content" required rows={8}
                    placeholder="Paste your policy or FAQ content here…"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" as const }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "#008060", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {isSubmitting ? "Saving…" : "Save Entry"}
                  </button>
                  <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                    Cancel
                  </button>
                </div>
              </fetcher.Form>
            )}

            {/* Edit form */}
            {!showAddForm && selected && editing && (
              <fetcher.Form method="post" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="hidden" name="intent" value="update_entry" />
                <input type="hidden" name="id" value={selected.id} />
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>Edit Entry</h3>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Title</label>
                  <input
                    name="title" defaultValue={selected.title} required
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, boxSizing: "border-box" as const }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Content</label>
                  <textarea
                    name="content" defaultValue={selected.content} required rows={10}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" as const }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: "8px", borderRadius: 8, background: "#008060", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {isSubmitting ? "Saving…" : "Save Changes"}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 13, cursor: "pointer", color: "#374151" }}>
                    Cancel
                  </button>
                </div>
              </fetcher.Form>
            )}

            {/* Detail view */}
            {!showAddForm && selected && !editing && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>{selected.title}</h3>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setEditing(true)} title="Edit" style={{ padding: 6, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Pencil size={14} color="#6b7280" />
                    </button>
                    <button onClick={() => handleToggle(selected.id, selected.status)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 500, color: "#6b7280" }}>
                      {selected.status === "active" ? "Set Draft" : "Activate"}
                    </button>
                    <button onClick={() => handleDelete(selected.id)} title="Delete" style={{ padding: 6, borderRadius: 6, border: "1px solid #fee2e2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center" }}>
                      <Trash2 size={14} color="#b91c1c" />
                    </button>
                  </div>
                </div>
                <div style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb", maxHeight: 320, overflowY: "auto" }}>
                  <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                    {selected.content}
                  </p>
                </div>
                <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                  Source: {sourceLabel(selected.source)} · Last updated: {new Date(selected.updatedAt).toLocaleDateString()}
                </p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>
                  {selected.status === "active"
                    ? "✓ Active — the AI will use this content when answering questions"
                    : "⚠ Draft — hidden from the AI"}
                </p>
              </div>
            )}

            {/* Empty state */}
            {!showAddForm && !selected && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200, textAlign: "center", color: "#9ca3af" }}>
                <BookOpen size={28} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, margin: 0 }}>Select an entry to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
