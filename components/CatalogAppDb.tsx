"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Asset, Kind, KIND_META, KINDS, SUGGESTED_CATEGORIES } from "@/lib/types";
import { exportJson, faviconOf, hostnameOf, matchesQuery, newId, parseImport } from "@/lib/storage";

type FilterKind = "all" | Kind;
type Toast = { id: number; message: string; undo?: () => void };

type Draft = {
  title: string;
  url: string;
  kind: Kind;
  category: string;
  tags: string;
  notes: string;
  favorite: boolean;
};

type AssetUpsert = Omit<Asset, "id" | "createdAt" | "updatedAt"> & { id?: string };

function emptyDraft(): Draft {
  return {
    title: "",
    url: "",
    kind: "component",
    category: "",
    tags: "",
    notes: "",
    favorite: false,
  };
}

function PasswordGateDialog({
  onClose,
  onSubmit,
  error,
}: {
  onClose: () => void;
  onSubmit: (pass: string) => void;
  error?: string;
}) {
  const [pass, setPass] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pass.trim()) return;
    onSubmit(pass.trim());
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div className="dialog-head">
          <h2 id="gate-title">Private access</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p style={{ margin: "-6px 0 14px", color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.5 }}>
          Enter the password to view and save your personal catalog.
        </p>

        <div className="field">
          <span>Password</span>
          <input
            ref={firstRef}
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Your catalog password"
            autoComplete="current-password"
          />
        </div>

        {error ? <p className="err">{error}</p> : null}

        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            Unlock
          </button>
        </div>
      </form>
    </div>
  );
}

export function CatalogAppDb() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const [category, setCategory] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editor, setEditor] = useState<Asset | "new" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authPass, setAuthPass] = useState<string | null>(null);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authError, setAuthError] = useState<string | undefined>(undefined);

  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toastN = useRef(0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("myassets.pass");
      if (saved) setAuthPass(saved);
    } catch {
      // ignore
    }
  }, []);

  const pushToast = useCallback((message: string, undo?: () => void) => {
    const id = ++toastN.current;
    setToasts((t) => [{ id, message, undo }, ...t].slice(0, 3));
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5200);
  }, []);

  async function syncAssets(pass?: string | null) {
    setReady(false);
    try {
      const headers: HeadersInit = {};
      if (pass) headers["x-asset-password"] = pass;
      const res = await fetch("/api/assets", { headers });

      if (res.status === 401) {
        setAuthGateOpen(true);
        setAuthError(undefined);
        setReady(false);
        return;
      }

      if (!res.ok) {
        pushToast("Could not load catalog");
        setReady(true);
        return;
      }

      const data = (await res.json()) as { assets: Asset[] };
      setAssets(data.assets || []);
      setReady(true);
    } catch {
      pushToast("Network error");
      setReady(true);
    }
  }

  // Sync whenever we (re)gain access.
  useEffect(() => {
    void syncAssets(authPass);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authPass]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setEditor(null);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("content-type") && init.body) {
      headers.set("content-type", "application/json");
    }
    if (authPass) headers.set("x-asset-password", authPass);

    const res = await fetch(path, { ...init, headers });
    if (res.status === 401) {
      setAuthGateOpen(true);
      setAuthError("Wrong password");
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Request failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.category).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const filtered = useMemo(() => {
    return assets
      .filter((a) => matchesQuery(a, query))
      .filter((a) => (kind === "all" ? true : a.kind === kind))
      .filter((a) => (category === "all" ? true : a.category === category))
      .filter((a) => (favoritesOnly ? a.favorite : true))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt));
  }, [assets, query, kind, category, favoritesOnly]);

  const grouped = useMemo(() => {
    const order: Kind[] = [...KINDS];
    return order
      .map((k) => ({
        kind: k,
        items: filtered.filter((a) => a.kind === k),
      }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: assets.length };
    for (const k of KINDS) map[k] = assets.filter((a) => a.kind === k).length;
    return map;
  }, [assets]);

  async function upsert(input: AssetUpsert) {
    const id = input.id ?? newId();
    const payload = {
      id,
      title: input.title,
      url: input.url,
      kind: input.kind,
      category: input.category,
      tags: input.tags,
      notes: input.notes,
      favorite: input.favorite,
    };

    try {
      if (input.id) {
        await authedFetch(`/api/assets/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        pushToast("Record updated");
      } else {
        await authedFetch(`/api/assets`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        pushToast("Record saved");
      }
      setEditor(null);
      await syncAssets(authPass ?? undefined);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    const snapshot = assets.find((a) => a.id === id);
    try {
      await authedFetch(`/api/assets/${id}`, { method: "DELETE" });
      await syncAssets(authPass ?? undefined);
      pushToast("Record removed", snapshot ? () => void restore(snapshot) : undefined);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Remove failed");
    }
  }

  async function restore(asset: Asset) {
    try {
      await authedFetch(`/api/assets/import`, {
        method: "POST",
        body: JSON.stringify([asset]),
      });
      await syncAssets(authPass ?? undefined);
      pushToast("Record restored");
    } catch {
      pushToast("Restore failed");
    }
  }

  async function toggleFavorite(id: string) {
    const current = assets.find((a) => a.id === id);
    if (!current) return;
    try {
      await authedFetch(`/api/assets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ favorite: !current.favorite }),
      });
      await syncAssets(authPass ?? undefined);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      pushToast("Link copied");
    } catch {
      pushToast("Could not copy");
    }
  }

  async function onImport(file: File) {
    try {
      const text = await file.text();
      const incoming = parseImport(text);
      await authedFetch(`/api/assets/import`, {
        method: "POST",
        body: JSON.stringify(incoming),
      });
      await syncAssets(authPass ?? undefined);
      pushToast(`Imported ${incoming.length} records`);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function clearCatalog() {
    try {
      await authedFetch(`/api/assets/clear`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      await syncAssets(authPass ?? undefined);
      pushToast("Catalog cleared");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Clear failed");
    }
  }

  return (
    <div className="page">
      {authGateOpen ? (
        <PasswordGateDialog
          onClose={() => setAuthGateOpen(false)}
          error={authError}
          onSubmit={async (pass) => {
            setAuthError(undefined);
            setAuthPass(pass);
            try {
              window.localStorage.setItem("myassets.pass", pass);
            } catch {
              // ignore
            }
            setAuthGateOpen(false);
            await syncAssets(pass);
          }}
        />
      ) : null}

      <header className="mast">
        <div className="mast-left">
          <p className="eyebrow">Personal material library</p>
          <h1>MyAssets</h1>
          <p className="lede">
            One catalog for components, design references, and web or mobile links you will actually reuse.
          </p>
        </div>
        <div className="mast-right">
          <dl className="holdings">
            <div>
              <dt>Holdings</dt>
              <dd>{ready ? assets.length : "—"}</dd>
            </div>
            <div>
              <dt>On this view</dt>
              <dd>{ready ? filtered.length : "—"}</dd>
            </div>
          </dl>
          <div className="mast-actions">
            <button className="btn ghost" type="button" onClick={() => setMenuOpen((v) => !v)}>
              Catalog
            </button>
            <button className="btn primary" type="button" onClick={() => setEditor("new")}>
              Add record
            </button>
          </div>
          {menuOpen ? (
            <div className="menu" role="menu">
              <button
                type="button"
                onClick={() => {
                  exportJson(assets);
                  setMenuOpen(false);
                }}
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  fileRef.current?.click();
                  setMenuOpen(false);
                }}
              >
                Import JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void clearCatalog();
                }}
              >
                Clear catalog
              </button>
            </div>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImport(file);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      <section className="finding-aid" aria-label="Search the catalog">
        <label className="search">
          <span className="search-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, site, tags, notes…"
            aria-label="Search records"
          />
          {query ? (
            <button className="clear" type="button" onClick={() => setQuery("")} aria-label="Clear search">
              ×
            </button>
          ) : (
            <kbd>Ctrl K</kbd>
          )}
        </label>

        <div className="filters" role="tablist" aria-label="Sections">
          <FilterChip
            active={kind === "all"}
            onClick={() => setKind("all")}
            label="All"
            count={counts.all}
          />
          {KINDS.map((k) => (
            <FilterChip
              key={k}
              active={kind === k}
              onClick={() => setKind(k)}
              label={KIND_META[k].label}
              count={counts[k]}
              color={KIND_META[k].spine}
            />
          ))}
        </div>

        <div className="chips-row">
          <button
            type="button"
            className={`chip ${favoritesOnly ? "on" : ""}`}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            Starred
          </button>
          <span className="chip-rule" />
          <button
            type="button"
            className={`chip ${category === "all" ? "on" : ""}`}
            onClick={() => setCategory("all")}
          >
            Any category
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${category === c ? "on" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <main>
        {!ready ? (
          <div className="skeleton-grid" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skel" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={assets.length > 0}
            onAdd={() => setEditor("new")}
            onReset={() => {
              setQuery("");
              setKind("all");
              setCategory("all");
              setFavoritesOnly(false);
            }}
          />
        ) : (
          grouped.map((group) => (
            <section key={group.kind} className="shelf" id={group.kind}>
              <header className="shelf-head">
                <span className="spine-dot" style={{ background: KIND_META[group.kind].spine }} />
                <div>
                  <h2>{KIND_META[group.kind].label}</h2>
                  <p>{KIND_META[group.kind].blurb}</p>
                </div>
                <span className="count">{group.items.length}</span>
              </header>
              <ul className="grid">
                {group.items.map((asset) => (
                  <li key={asset.id}>
                    <AssetCard
                      asset={asset}
                      onEdit={() => setEditor(asset)}
                      onDelete={() => remove(asset.id)}
                      onFavorite={() => toggleFavorite(asset.id)}
                      onCopy={() => void copyUrl(asset.url)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <footer className="colophon">
        <p>
          Records are stored in your database. Export JSON anytime, or import to merge catalogs.
        </p>
      </footer>

      {editor ? (
        <EditorDialog
          asset={editor === "new" ? null : editor}
          categories={[...new Set([...SUGGESTED_CATEGORIES, ...categories])]}
          onClose={() => setEditor(null)}
          onSave={upsert}
        />
      ) : null}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.message}</span>
            {t.undo ? (
              <button type="button" onClick={t.undo}>
                Undo
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
}) {
  return (
    <button type="button" className={`filter ${active ? "on" : ""}`} onClick={onClick} role="tab" aria-selected={active}>
      {color ? <span className="dot" style={{ background: color }} /> : null}
      {label}
      <span className="n">{count}</span>
    </button>
  );
}

function AssetCard({
  asset,
  onEdit,
  onDelete,
  onFavorite,
  onCopy,
}: {
  asset: Asset;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onCopy: () => void;
}) {
  return (
    <article className="card">
      <div style={{ background: KIND_META[asset.kind].spine }} />
      <div className="card-body">
        <div className="card-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="favicon" alt="" src={faviconOf(asset.url)} width={28} height={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="title">
              <a href={asset.url} target="_blank" rel="noreferrer">
                {asset.title}
              </a>
            </h3>
            <p className="meta">
              {hostnameOf(asset.url)} · {asset.category || "Unsorted"}
            </p>
          </div>
          <button
            type="button"
            className={`fav ${asset.favorite ? "on" : ""}`}
            onClick={onFavorite}
            aria-label={asset.favorite ? "Unstar" : "Star"}
          >
            {asset.favorite ? "★" : "☆"}
          </button>
        </div>
        {asset.notes ? <p className="notes">{asset.notes}</p> : <span className="notes" />}
        {asset.tags.length ? (
          <div className="tags">
            {asset.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="card-actions">
          <a className="linkish" href={asset.url} target="_blank" rel="noreferrer">
            Open
          </a>
          <button type="button" onClick={onCopy}>
            Copy
          </button>
          <button type="button" onClick={onEdit}>
            Edit
          </button>
          <button type="button" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({
  hasAny,
  onAdd,
  onReset,
}: {
  hasAny: boolean;
  onAdd: () => void;
  onReset: () => void;
}) {
  return (
    <div className="empty">
      <h2>{hasAny ? "Nothing matches this search" : "The catalog is empty"}</h2>
      <p>
        {hasAny
          ? "Try another word, clear a filter, or save a new record."
          : "Add the first component, inspiration, or reference you want to keep."}
      </p>
      <div className="mast-actions" style={{ justifyContent: "center" }}>
        {hasAny ? (
          <button className="btn ghost" type="button" onClick={onReset}>
            Clear filters
          </button>
        ) : null}
        <button className="btn primary" type="button" onClick={onAdd}>
          Add record
        </button>
      </div>
    </div>
  );
}

function EditorDialog({
  asset,
  categories,
  onClose,
  onSave,
}: {
  asset: Asset | null;
  categories: string[];
  onClose: () => void;
  onSave: (input: AssetUpsert) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    asset
      ? {
          title: asset.title,
          url: asset.url,
          kind: asset.kind,
          category: asset.category,
          tags: asset.tags.join(", "),
          notes: asset.notes,
          favorite: asset.favorite,
        }
      : emptyDraft(),
  );
  const [error, setError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    let url = String(draft.url).trim();
    if (!title) return setError("Give the record a name.");
    if (!url) return setError("Paste a URL.");
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      new URL(url);
    } catch {
      return setError("That URL is not valid.");
    }
    const tags = draft.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      id: asset?.id,
      title,
      url,
      kind: draft.kind as Kind,
      category: draft.category.trim() || "Unsorted",
      tags,
      notes: draft.notes.trim(),
      favorite: Boolean(draft.favorite),
    });
  }

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="dialog-head">
          <h2 id="edit-title">{asset ? "Edit record" : "Add record"}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="field">
          <span>Section</span>
          <div className="kind-picks">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className={draft.kind === k ? "on" : ""}
                onClick={() => setDraft((d) => ({ ...d, kind: k }))}
              >
                {KIND_META[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Name</span>
          <input
            ref={firstRef}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Mobbin mobile flows"
          />
        </div>
        <div className="field">
          <span>Link</span>
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={draft.url}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            placeholder="https://"
          />
        </div>
        <div className="field">
          <span>Category</span>
          <input
            list="cats"
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            placeholder="Native patterns"
          />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <span>Tags</span>
          <input
            value={draft.tags}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
            placeholder="ios, flows, paywall"
          />
        </div>
        <div className="field">
          <span>Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Why you saved this, and when to reach for it."
          />
        </div>
        <label className="field star-row">
          <input
            type="checkbox"
            checked={Boolean(draft.favorite)}
            onChange={(e) => setDraft((d) => ({ ...d, favorite: e.target.checked }))}
          />
          <span>Star this record</span>
        </label>
        {error ? <p className="err">{error}</p> : null}
        <div className="dialog-actions">
          <button className="btn ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" type="submit">
            {asset ? "Save changes" : "Save record"}
          </button>
        </div>
      </form>
    </div>
  );
}

