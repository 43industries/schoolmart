"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import {
  vendorApi,
  catalogApi,
  ApiError,
  resolveMediaUrl,
  productPrimaryImage,
  type Product,
  type Category,
} from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatKES, toMinorUnits } from "@schoolmart/shared";

const navItems = [
  { href: "/vendor", label: "Catalog" },
];

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function VendorDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendorStatus, setVendorStatus] = useState<string>("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    priceKes: "",
    categoryId: "",
    availableQty: "10",
    status: "DRAFT",
  });

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user && !user.roles.some((r) => r.role === "VENDOR")) router.push(getDashboardPath(getPrimaryRole(user)));
  }, [user, loading, router]);

  const load = async () => {
    const [me, prods, cats] = await Promise.all([
      vendorApi.me(),
      vendorApi.products(),
      catalogApi.categories(),
    ]);
    setVendorStatus(me.status);
    setProducts(prods.products);
    setCategories(cats.categories);
  };

  useEffect(() => {
    if (!user) return;
    load().catch(() => {});
  }, [user]);

  const resetForm = () => {
    setForm({
      name: "",
      slug: "",
      description: "",
      priceKes: "",
      categoryId: "",
      availableQty: "10",
      status: "DRAFT",
    });
    setImageUrls([]);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setShowForm(true);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? "",
      priceKes: String(p.priceMinor / 100),
      categoryId: p.category?.id ?? "",
      availableQty: String(p.inventory?.availableQty ?? 0),
      status: p.status,
    });
    setImageUrls(Array.isArray(p.images) ? p.images.filter((u): u is string => typeof u === "string") : []);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    setUploading(true);
    try {
      const next = [...imageUrls];
      for (const file of Array.from(files)) {
        if (next.length >= 5) break;
        if (!file.type.startsWith("image/")) {
          setError("Only image files can be uploaded");
          continue;
        }
        const saved = await vendorApi.uploadImage(file);
        next.push(saved.url);
      }
      setImageUrls(next);
      setMessage("Photo uploaded");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const priceKes = Number(form.priceKes);
      if (!Number.isFinite(priceKes) || priceKes <= 0) {
        setError("Enter a valid price");
        return;
      }
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        slug: (form.slug || slugify(form.name)).trim(),
        description: form.description.trim() || undefined,
        priceMinor: toMinorUnits(priceKes),
        status: form.status,
        availableQty: Number(form.availableQty) || 0,
        categoryId: form.categoryId || undefined,
        images: imageUrls,
      };
      if (editingId) {
        await vendorApi.updateProduct(editingId, payload);
        setMessage("Product updated");
      } else {
        await vendorApi.createProduct(payload);
        setMessage("Product posted");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: Product) => {
    setError("");
    try {
      const next = p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await vendorApi.updateProduct(p.id, { status: next });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Vendor Portal" navItems={navItems}>
      <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-brand-ink">Your catalog</h2>
        <p className="mt-1 text-brand-muted">
          Post products with photos. Schools approve what parents and students can order.
          {vendorStatus ? ` · Status: ${vendorStatus}` : ""}
        </p>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {vendorStatus && vendorStatus !== "APPROVED" && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Your vendor account is {vendorStatus.toLowerCase()}. An admin must approve you before products go live.
          </p>
        </Card>
      )}

      <div className="mb-6 flex items-center justify-between gap-4">
        <h3 className="font-semibold text-brand-ink">Products ({products.length})</h3>
        <Button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          Add product
        </Button>
      </div>

      {showForm && (
        <Card className="mb-8">
          <h3 className="mb-4 font-semibold text-brand-ink">{editingId ? "Edit product" : "New product"}</h3>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: editingId ? form.slug : slugify(e.target.value),
                })
              }
            />
            <Input
              label="Slug"
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
            <Input
              label="Price (KES)"
              required
              type="number"
              min="1"
              step="1"
              value={form.priceKes}
              onChange={(e) => setForm({ ...form, priceKes: e.target.value })}
            />
            <Input
              label="Stock qty"
              type="number"
              min="0"
              value={form.availableQty}
              onChange={(e) => setForm({ ...form, availableQty: e.target.value })}
            />
            <Select
              label="Category"
              options={[
                { value: "", label: "None" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            />
            <Select
              label="Status"
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "ACTIVE", label: "Active (publish)" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Input
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-3">
              <label className="label">Product photos</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                disabled={uploading || imageUrls.length >= 5}
                onChange={(e) => {
                  void handleUpload(e.target.files);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-brand-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-teal/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-teal"
              />
              <p className="text-xs text-brand-muted">
                Upload up to 5 photos (JPEG, PNG, WebP, GIF · max 5MB each).
                {uploading ? " Uploading…" : ""}
              </p>
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {imageUrls.map((url) => (
                    <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveMediaUrl(url)} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white"
                        onClick={() => setImageUrls((prev) => prev.filter((u) => u !== url))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy || uploading}>
                {busy ? "Saving…" : editingId ? "Save changes" : "Post product"}
              </Button>
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {products.map((p) => {
          const thumb = productPrimaryImage(p);
          return (
            <Card key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-teal/5">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveMediaUrl(thumb)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-brand-muted">No photo</div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-brand-ink">{p.name}</p>
                  <p className="text-sm text-brand-muted">
                    {formatKES(p.priceMinor)} · stock {p.inventory?.availableQty ?? 0}
                    {p.category ? ` · ${p.category.name}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "ACTIVE"
                      ? "bg-green-100 text-green-700"
                      : p.status === "DRAFT"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.status}
                </span>
                <Button type="button" variant="secondary" onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button type="button" variant="secondary" onClick={() => toggleActive(p)}>
                  {p.status === "ACTIVE" ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </Card>
          );
        })}
        {products.length === 0 && (
          <p className="text-sm text-brand-muted">No products yet. Add your first listing above.</p>
        )}
      </div>
    </PortalLayout>
  );
}
