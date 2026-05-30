import { useState, useEffect } from "react";
import { useInventoryContext } from "../../context/InventoryContext";
import { Trash2, RefreshCw, ChevronRight, Package, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";

interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
}

export function BookingInventory() {
  const {
    batches,
    selectedBatchId,
    setSelectedBatchId,
    selectedPalletId,
    setSelectedPalletId,
    refreshBatchesFromDB,
    setBatches,
  } = useInventoryContext();

  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [batchSearchQuery, setBatchSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("auth_token") || "";
        const res = await fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setProducts(data.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku || p.name, price: parseFloat(p.price) || 0 })));
        }
        await refreshBatchesFromDB();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const currentBatch = batches.find((b) => b.id === selectedBatchId);
  const currentPallet = currentBatch?.pallets.find((p) => p.id === selectedPalletId) || null;

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name || productId;

  // ── Remove item from pallet ──────────────────────────────────────
  const handleRemoveItem = async (palletId: string, itemId: string) => {
    if (!confirm("Remove this item from the pallet?")) return;
    setIsDeleting(itemId);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`/api/batches/pallet-items/${itemId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove item");
      await refreshBatchesFromDB();
    } catch (err) {
      alert("Failed to remove item.");
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Remove pallet from batch ─────────────────────────────────────
  const handleRemovePallet = async (palletId: string) => {
    if (!confirm("Remove this entire pallet and all its items?")) return;
    setIsDeleting(palletId);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`/api/batches/pallets/${palletId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove pallet");
      if (selectedPalletId === palletId) setSelectedPalletId(null);
      await refreshBatchesFromDB();
    } catch (err) {
      alert("Failed to remove pallet.");
    } finally {
      setIsDeleting(null);
    }
  };

  // ── Remove whole batch ───────────────────────────────────────────
  const handleRemoveBatch = async (batchId: string) => {
    if (batchId === "batch-all") return;
    if (!confirm("Delete this entire batch and all its pallets?")) return;
    setIsDeleting(batchId);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const batchName = batches.find((b) => b.id === batchId)?.name;
      if (batchName) {
        const listRes = await fetch("/api/batches", { headers: { Authorization: `Bearer ${token}` } });
        const rows: any[] = listRes.ok ? await listRes.json() : [];
        const toDelete = rows.filter((r) => r.batch_name === batchName);
        await Promise.all(
          toDelete.map((r) =>
            fetch(`/api/batches/${r.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
          )
        );
      }
      if (selectedBatchId === batchId) setSelectedBatchId("batch-all");
      await refreshBatchesFromDB();
    } catch (err) {
      alert("Failed to delete batch.");
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) return <div className="p-6 text-gray-500">Loading inventory…</div>;

  const realBatches = batches.filter((b) => b.id !== "batch-all");

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Inventory</h1>
          <p className="text-gray-600">Manage batches, pallets, and items</p>
        </div>
        <button
          onClick={() => refreshBatchesFromDB()}
          className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-off-white flex items-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <button
          onClick={() => { setSelectedBatchId("batch-all"); setSelectedPalletId(null); }}
          className={`font-semibold ${selectedBatchId === "batch-all" ? "text-navy" : "hover:text-navy"}`}
        >
          All Batches
        </button>
        <ChevronRight size={14} />
        <button
          onClick={() => { setSelectedBatchId("batch-all-pallets"); setSelectedPalletId(null); }}
          className={`font-semibold ${selectedBatchId === "batch-all-pallets" ? "text-navy" : "hover:text-navy"}`}
        >
          All Products Pallet
        </button>
        {currentBatch && currentBatch.id !== "batch-all" && currentBatch.id !== "batch-all-pallets" && (
          <>
            <ChevronRight size={14} />
            <button
              onClick={() => setSelectedPalletId(null)}
              className={`font-semibold ${!selectedPalletId ? "text-navy" : "hover:text-navy"}`}
            >
              {currentBatch.name}
            </button>
          </>
        )}
        {currentPallet && (
          <>
            <ChevronRight size={14} />
            <span className="font-semibold text-navy">Pallet {currentPallet.palletId}</span>
          </>
        )}
      </div>

      {/* ── All Batches View ── */}
      {selectedBatchId === "batch-all" && (
        <div className="grid gap-4">
          {/* Search Bar */}
          <input
            type="text"
            value={batchSearchQuery}
            onChange={(e) => setBatchSearchQuery(e.target.value)}
            placeholder="Search batches…"
            className="w-full px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          />
          {realBatches.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <p>No batches found. Add batches from the main Inventory page.</p>
            </Card>
          ) : (
            realBatches
              .filter((batch) => batch.name.toLowerCase().includes(batchSearchQuery.toLowerCase()))
              .map((batch) => (
                <Card key={batch.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <button
                    className="flex-1 flex items-center gap-4 text-left"
                    onClick={() => { setSelectedBatchId(batch.id); setSelectedPalletId(null); }}
                  >
                    <div className="w-10 h-10 rounded-full bg-accent-2/10 flex items-center justify-center">
                      <Layers size={18} className="text-accent-2" />
                    </div>
                    <div>
                      <p className="font-semibold text-navy">{batch.name}</p>
                      <p className="text-xs text-muted">{batch.pallets.length} pallet{batch.pallets.length !== 1 ? "s" : ""} · {batch.pallets.reduce((a, p) => a + p.items.length, 0)} items</p>
                      <p className="text-xs text-muted">{new Date(batch.createdAt).toLocaleDateString()}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleRemoveBatch(batch.id)}
                    disabled={isDeleting === batch.id}
                    className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                    title="Delete batch"
                  >
                    <Trash2 size={16} />
                  </button>
                </Card>
              ))
          )}
        </div>
      )}

      {/* ── All Products Pallet View ── */}
      {selectedBatchId === "batch-all-pallets" && (
        <div className="flex flex-col gap-4">
          {/* Collect all pallets from all batches */}
          {(() => {
            const allPallets = realBatches.flatMap((batch) =>
              batch.pallets.map((pallet) => ({ ...pallet, batchId: batch.id, batchName: batch.name }))
            );

            return allPallets.length === 0 ? (
              <Card className="p-8 text-center text-gray-400">
                <Package size={32} className="mx-auto mb-2 opacity-40" />
                <p>No pallets found.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allPallets.map((pallet: any) => (
                  <Card key={pallet.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                    <button
                      className="flex-1 flex items-center gap-4 text-left"
                      onClick={() => { setSelectedBatchId(pallet.batchId); setSelectedPalletId(null); }}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Package size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-navy">Pallet {pallet.palletId}</p>
                        <p className="text-xs text-muted">Batch: {pallet.batchName}</p>
                        {pallet.supplierName && <p className="text-xs text-muted">Supplier: {pallet.supplierName}</p>}
                        {pallet.storageZone && <p className="text-xs text-muted">Zone: {pallet.storageZone}</p>}
                        <p className="text-xs text-muted">{pallet.items.length} item{pallet.items.length !== 1 ? "s" : ""} · {pallet.items.reduce((a: any, i: any) => a + i.quantity, 0)} units total</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRemovePallet(pallet.id)}
                      disabled={isDeleting === pallet.id}
                      className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                      title="Remove pallet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Batch → Pallets View ── */}
      {currentBatch && currentBatch.id !== "batch-all" && !selectedPalletId && (
        <div className="grid gap-4">
          {currentBatch.pallets.length === 0 ? (
            <Card className="p-8 text-center text-gray-400">
              <p>No pallets in this batch.</p>
            </Card>
          ) : (
            currentBatch.pallets.map((pallet) => (
              <Card key={pallet.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                <button
                  className="flex-1 flex items-center gap-4 text-left"
                  onClick={() => setSelectedPalletId(pallet.id)}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Package size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy">Pallet {pallet.palletId}</p>
                    {pallet.supplierName && <p className="text-xs text-muted">Supplier: {pallet.supplierName}</p>}
                    {pallet.storageZone && <p className="text-xs text-muted">Zone: {pallet.storageZone}</p>}
                    <p className="text-xs text-muted">{pallet.items.length} item{pallet.items.length !== 1 ? "s" : ""} · {pallet.items.reduce((a, i) => a + i.quantity, 0)} units total</p>
                  </div>
                </button>
                <button
                  onClick={() => handleRemovePallet(pallet.id)}
                  disabled={isDeleting === pallet.id}
                  className="ml-4 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                  title="Remove pallet"
                >
                  <Trash2 size={16} />
                </button>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Pallet → Items View ── */}
      {currentPallet && (
        <div className="flex flex-col gap-4">
          <div className="bg-off-white rounded-xl p-4 border border-border text-sm text-navy space-y-1">
            <p><span className="font-semibold">Pallet ID:</span> {currentPallet.palletId}</p>
            {currentPallet.supplierName && <p><span className="font-semibold">Supplier:</span> {currentPallet.supplierName}</p>}
            {currentPallet.receivedDate && <p><span className="font-semibold">Received:</span> {currentPallet.receivedDate}</p>}
            {currentPallet.storageZone && <p><span className="font-semibold">Zone:</span> {currentPallet.storageZone}</p>}
            {currentPallet.placementLocation && <p><span className="font-semibold">Location:</span> {currentPallet.placementLocation}</p>}
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items…"
            className="w-full px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
          />

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-off-white">
                  <th className="text-left px-4 py-3 font-semibold text-navy">Product</th>
                  <th className="text-right px-4 py-3 font-semibold text-navy">Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-navy">Expiry Note</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {currentPallet.items
                  .filter((item) => {
                    const name = getProductName(item.productId).toLowerCase();
                    return name.includes(searchQuery.toLowerCase());
                  })
                  .map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-off-white/50">
                      <td className="px-4 py-3 font-medium text-navy">{getProductName(item.productId)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-3 text-muted text-xs">{item.expirationNote || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRemoveItem(currentPallet.id, item.id)}
                          disabled={isDeleting === item.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-40"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                {currentPallet.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No items in this pallet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
