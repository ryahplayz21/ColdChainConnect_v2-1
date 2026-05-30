import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { RefreshCw, ChevronLeft, Truck as TruckIcon, ChevronDown, ChevronUp } from "lucide-react";
import { Delivery, DeliveryItem, Truck, Invoice, Customer, Driver } from "@shared/api";

// ─── Extended types ────────────────────────────────────────────────────────────

interface DeliveryItemExt extends DeliveryItem {
  completed_at?: string;
  receipt_number?: string;
  invoice?: Invoice;
  customer?: Customer;
}

interface DeliveryExt extends Delivery {
  delivery_items: DeliveryItemExt[];
  truck?: Truck;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

function statusBadgeClass(status: string) {
  return (
    status === "completed"  ? "badge-green" :
    status === "in_transit" ? "badge-gold"  :
    "badge-blue"
  );
}

function statusLabel(status: string) {
  return status === "in_transit" ? "In Transit" :
         status === "completed"  ? "Completed"  : "Pending";
}

function truckStatusLabel(status: string) {
  return status === "in_transit" ? "In Transit" :
         status === "maintenance" ? "Maintenance" : "Available";
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function DeliveryDispatch() {
  const { token } = useAuth();

  const [trucks,      setTrucks]      = useState<Truck[]>([]);
  const [drivers,     setDrivers]     = useState<Driver[]>([]);
  const [deliveries,  setDeliveries]  = useState<DeliveryExt[]>([]);
  const [invoices,    setInvoices]    = useState<Invoice[]>([]);
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedTruck,        setSelectedTruck]        = useState<Truck | null>(null);
  const [selectedDelivery,     setSelectedDelivery]     = useState<DeliveryExt | null>(null);
  const [showAddTruckModal,    setShowAddTruckModal]    = useState(false);
  const [showAddDeliveryModal, setShowAddDeliveryModal] = useState(false);
  const [showChangeDriverModal,setShowChangeDriverModal]= useState(false);
  const [confirmingItem,       setConfirmingItem]       = useState<string | null>(null);
  const [deliverySearchQuery,  setDeliverySearchQuery]  = useState("");

  // Mobile: track which "panel" is visible — "trucks" | "detail"
  const [mobileView, setMobileView] = useState<"trucks" | "detail">("trucks");

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [truckRes, driverRes, deliveryRes, invoiceRes, customerRes] = await Promise.all([
        fetch("/api/trucks",     { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/drivers",    { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/deliveries", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/invoices",   { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/customers",  { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [trucksData, driversData, deliveriesData, invoicesData, customersData] = await Promise.all([
        truckRes.ok    ? truckRes.json()    : [],
        driverRes.ok   ? driverRes.json()   : [],
        deliveryRes.ok ? deliveryRes.json() : [],
        invoiceRes.ok  ? invoiceRes.json()  : [],
        customerRes.ok ? customerRes.json() : [],
      ]);

      setTrucks(trucksData);
      setDrivers(driversData);
      setInvoices(invoicesData);
      setCustomers(customersData);

      const joined: DeliveryExt[] = (deliveriesData as DeliveryExt[]).map((d) => ({
        ...d,
        truck: (trucksData as Truck[]).find((t) => t.id === d.truck_id),
        delivery_items: (d.delivery_items ?? []).map((item) => ({
          ...item,
          invoice:  (invoicesData  as Invoice[]).find((inv) => inv.id === item.invoice_id),
          customer: (customersData as Customer[]).find((c)   => c.id   === item.destination_customer_id),
        })),
      }));
      setDeliveries(joined);

      if (selectedTruck) {
        const refreshed = (trucksData as Truck[]).find((t) => t.id === selectedTruck.id);
        setSelectedTruck(refreshed ?? null);
      }
      if (selectedDelivery) {
        const refreshed = joined.find((d) => d.id === selectedDelivery.id);
        setSelectedDelivery(refreshed ?? null);
      }
      setError(null);
    } catch {
      setError("Failed to load data. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAll();
    setIsRefreshing(false);
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const truckDeliveries = selectedTruck
    ? deliveries.filter((d) => {
        const matchesTruck = d.truck_id === selectedTruck.id;
        const matchesSearch =
          d.id.toLowerCase().includes(deliverySearchQuery.toLowerCase()) ||
          d.delivery_items.some(item => item.customer?.store_name?.toLowerCase().includes(deliverySearchQuery.toLowerCase()));
        return matchesTruck && matchesSearch;
      })
    : [];

  const handleConfirm = async (delivery: DeliveryExt, item: DeliveryItemExt) => {
    if (!token) return;
    setConfirmingItem(item.id);
    try {
      const res = await fetch(
        `/api/deliveries/${delivery.id}/items/${item.id}/confirm`,
        { method: "POST", headers: authHeaders(token), body: JSON.stringify({}) }
      );
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
    } catch (err) {
      alert("Failed to confirm: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setConfirmingItem(null);
    }
  };

  const handleCreateDelivery = async (destinations: { invoice_id: string; destination_customer_id: string }[]) => {
    if (!token || !selectedTruck) return;
    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ truck_id: selectedTruck.id, destinations }),
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAll();
      setShowAddDeliveryModal(false);
    } catch (err) {
      alert("Failed to create delivery: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const assignedInvoiceIds = new Set(
    deliveries
      .filter((d) => d.status !== "completed")
      .flatMap((d) => d.delivery_items.map((i) => i.invoice_id))
  );
  const eligibleInvoices = invoices.filter(
    (inv) => (inv.status === "issued" || inv.status === "draft") &&
             inv.payment_status === "unpaid" &&
             !assignedInvoiceIds.has(inv.id)
  );

  const selectTruck = (truck: Truck) => {
    setSelectedTruck(truck);
    setSelectedDelivery(null);
    setMobileView("detail");
  };

  if (loading) return <div className="flex-1 px-6 py-8 text-sm text-muted">Loading deliveries…</div>;

  // ── Truck detail panel (shared between mobile and desktop) ─────────────────
  const DetailPanel = () => (
    <div className="space-y-4">
      {/* Mobile back button */}
      <button
        onClick={() => setMobileView("trucks")}
        className="md:hidden flex items-center gap-1 text-sm font-semibold text-accent-2 mb-1"
      >
        <ChevronLeft size={16} /> All Trucks
      </button>

      {/* Truck card */}
      <div className="bg-white rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Truck</p>
            <p className="font-rajdhani font-bold text-navy text-lg mt-0.5">{selectedTruck!.name}</p>
            <p className="text-xs text-muted">{selectedTruck!.district}</p>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(selectedTruck!.status)}`}>
            {truckStatusLabel(selectedTruck!.status)}
          </span>
        </div>

        {/* Driver */}
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Driver</p>
            {truckDeliveries.some((d) => d.status !== "completed") ? (
              <span className="text-xs font-semibold text-accent-2 bg-accent-2/10 px-2 py-1 rounded">Locked</span>
            ) : (
              <button onClick={() => setShowChangeDriverModal(true)} className="text-xs font-semibold text-accent-2 hover:opacity-70">
                Change
              </button>
            )}
          </div>
          {selectedTruck!.driver_id ? (() => {
            const driver = drivers.find((d) => d.id === selectedTruck!.driver_id);
            return (
              <div className="bg-off-white rounded-lg p-3">
                <p className="font-semibold text-navy text-sm">{driver?.full_name || "Unknown Driver"}</p>
                {driver?.contact_info && (
                  <p className="text-xs text-muted mt-0.5">{driver.contact_info}</p>
                )}
              </div>
            );
          })() : (
            <div className="bg-off-white rounded-lg p-3 text-center text-xs text-muted">No driver assigned</div>
          )}
        </div>

        <button
          onClick={() => setShowAddDeliveryModal(true)}
          className="w-full px-3 py-2.5 bg-navy text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          + Add Delivery
        </button>
      </div>

      {/* Search Bar */}
      <input
        type="text"
        value={deliverySearchQuery}
        onChange={(e) => setDeliverySearchQuery(e.target.value)}
        placeholder="Search deliveries by ID or customer…"
        className="w-full px-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2"
      />

      {/* Deliveries */}
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">
        Deliveries ({truckDeliveries.length})
      </p>

      {truckDeliveries.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-6 text-center text-sm text-muted">
          No deliveries for this truck yet.
        </div>
      ) : (
        truckDeliveries.map((delivery) => (
          <div
            key={delivery.id}
            className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
              selectedDelivery?.id === delivery.id ? "border-accent-2" : "border-border"
            }`}
          >
            {/* Delivery header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-off-white/50 transition-colors"
              onClick={() => setSelectedDelivery(selectedDelivery?.id === delivery.id ? null : delivery)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${statusBadgeClass(delivery.status)}`}>
                  {statusLabel(delivery.status)}
                </span>
                <span className="font-mono text-xs text-muted truncate">{delivery.id.slice(0, 8)}…</span>
                <span className="text-xs text-muted flex-shrink-0">{delivery.delivery_items.length} stop{delivery.delivery_items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className="text-xs text-muted hidden sm:block">
                  {new Date(delivery.created_at).toLocaleDateString("en-PH")}
                </span>
                {selectedDelivery?.id === delivery.id
                  ? <ChevronUp size={14} className="text-muted" />
                  : <ChevronDown size={14} className="text-muted" />
                }
              </div>
            </div>

            {/* Delivery stops — card layout on mobile, table on md+ */}
            {selectedDelivery?.id === delivery.id && (
              <div className="border-t border-border">
                {delivery.delivery_items.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted">No stops assigned yet.</p>
                ) : (
                  <>
                    {/* Mobile: card per stop */}
                    <div className="md:hidden divide-y divide-border">
                      {delivery.delivery_items.map((item) => (
                        <div key={item.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-navy text-sm">
                              {item.customer?.store_name ?? item.destination_customer_id.slice(0, 8)}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                              {statusLabel(item.status)}
                            </span>
                          </div>
                          {item.customer?.location && (
                            <p className="text-xs text-muted">{item.customer.location}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                            <span className="font-mono">Invoice: {item.invoice_id.slice(0, 8)}…</span>
                            {item.invoice && (
                              <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                item.invoice.status === "paid" ? "badge-green" : "badge-gold"
                              }`}>
                                {item.invoice.status}
                              </span>
                            )}
                          </div>
                          {item.receipt_number && (
                            <p className="text-xs text-muted">Receipt: {item.receipt_number}</p>
                          )}
                          {item.completed_at && (
                            <p className="text-xs text-muted">
                              Confirmed: {new Date(item.completed_at).toLocaleString("en-PH")}
                            </p>
                          )}
                          {item.status === "completed" ? (
                            <span className="text-xs text-green font-semibold">✅ Done</span>
                          ) : (
                            <button
                              disabled={confirmingItem === item.id}
                              onClick={() => handleConfirm(delivery, item)}
                              className="w-full mt-1 px-3 py-2 bg-green text-white rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {confirmingItem === item.id ? "Confirming…" : "✓ Confirm Delivery"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop: table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            {["Invoice", "Customer", "Status", "Receipt #", "Confirmed At", "Action"].map((h) => (
                              <th key={h} className="bg-navy-mid text-muted font-semibold text-xs uppercase tracking-wider px-3 py-2.5 text-left border-b border-border whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {delivery.delivery_items.map((item) => (
                            <tr key={item.id} className="border-b border-border hover:bg-off-white/40 transition-colors">
                              <td className="px-3 py-3 font-mono text-navy">
                                {item.invoice_id.slice(0, 8)}…
                                {item.invoice && (
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-semibold ${
                                    item.invoice.status === "paid" ? "badge-green" : "badge-gold"
                                  }`}>
                                    {item.invoice.status}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-navy font-semibold">
                                {item.customer?.store_name ?? item.destination_customer_id.slice(0, 8)}
                                {item.customer?.location && (
                                  <p className="text-muted font-normal">{item.customer.location}</p>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                                  {statusLabel(item.status)}
                                </span>
                              </td>
                              <td className="px-3 py-3 font-mono text-navy">
                                {item.receipt_number ?? <span className="text-muted">—</span>}
                              </td>
                              <td className="px-3 py-3 text-muted">
                                {item.completed_at
                                  ? new Date(item.completed_at).toLocaleString("en-PH")
                                  : <span className="text-muted">—</span>
                                }
                              </td>
                              <td className="px-3 py-3">
                                {item.status === "completed" ? (
                                  <span className="text-xs text-green font-semibold">✅ Done</span>
                                ) : (
                                  <button
                                    disabled={confirmingItem === item.id}
                                    onClick={() => handleConfirm(delivery, item)}
                                    className="px-3 py-1 bg-green text-white rounded text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                                  >
                                    {confirmingItem === item.id ? "Confirming…" : "✓ Confirm Delivery"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col px-4 md:px-6 py-4 md:py-6 gap-4 min-h-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="font-rajdhani text-2xl md:text-3xl font-bold text-navy">Delivery & Dispatch</h1>
          <p className="text-xs text-muted mt-0.5">Assign invoices to trucks and track deliveries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-navy hover:bg-off-white disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddTruckModal(true)}
            className="px-3 py-2 bg-accent-2 text-white rounded-lg font-semibold text-sm hover:opacity-90"
          >
            + Add Truck
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-2 text-xs text-red flex-shrink-0">
          ⚠️ {error}
        </div>
      )}

      {/* ── Mobile: stacked (trucks list OR detail) ── */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {mobileView === "trucks" ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Trucks</p>
            {trucks.length === 0 ? (
              <p className="text-sm text-muted">No trucks registered yet.</p>
            ) : (
              trucks.map((truck) => {
                const td = deliveries.filter((d) => d.truck_id === truck.id);
                const active = td.filter((d) => d.status !== "completed").length;
                return (
                  <div
                    key={truck.id}
                    onClick={() => selectTruck(truck)}
                    className="bg-white rounded-xl border-2 border-border p-4 cursor-pointer active:bg-off-white transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                        <TruckIcon size={18} className="text-navy" />
                      </div>
                      <div>
                        <p className="font-rajdhani font-bold text-navy">{truck.name}</p>
                        <p className="text-xs text-muted">{truck.district}</p>
                        <p className="text-xs text-muted mt-0.5">{active} active · {td.length} total</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusBadgeClass(truck.status)}`}>
                        {truckStatusLabel(truck.status)}
                      </span>
                      <ChevronLeft size={14} className="text-muted rotate-180" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          selectedTruck && <DetailPanel />
        )}
      </div>

      {/* ── Desktop: side-by-side ── */}
      <div className="hidden md:flex gap-5 flex-1 min-h-0 overflow-hidden">
        {/* Truck list */}
        <div className="w-64 lg:w-72 flex-shrink-0 overflow-y-auto space-y-3 pr-1">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Trucks</p>
          {trucks.length === 0 ? (
            <p className="text-xs text-muted">No trucks registered yet.</p>
          ) : (
            trucks.map((truck) => {
              const td = deliveries.filter((d) => d.truck_id === truck.id);
              const active = td.filter((d) => d.status !== "completed").length;
              const isSelected = selectedTruck?.id === truck.id;
              return (
                <div
                  key={truck.id}
                  onClick={() => selectTruck(truck)}
                  className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? "border-accent-2 shadow-md" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-rajdhani font-bold text-navy leading-tight truncate">{truck.name}</p>
                      <p className="text-xs text-muted mt-0.5">{truck.district}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${statusBadgeClass(truck.status)}`}>
                      {truckStatusLabel(truck.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-2">
                    {active} active · {td.length} total
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto">
          {!selectedTruck ? (
            <div className="flex items-center justify-center h-full text-sm text-muted gap-2">
              <TruckIcon size={18} className="opacity-40" />
              Select a truck to view its deliveries
            </div>
          ) : (
            <DetailPanel />
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddTruckModal && (
        <AddTruckModal
          drivers={drivers}
          token={token!}
          onClose={() => setShowAddTruckModal(false)}
          onCreated={async () => { await fetchAll(); setShowAddTruckModal(false); }}
        />
      )}

      {showChangeDriverModal && selectedTruck && (
        <ChangeDriverModal
          truck={selectedTruck}
          drivers={drivers}
          token={token!}
          onClose={() => setShowChangeDriverModal(false)}
          onSave={async (driverId) => {
            try {
              const res = await fetch(`/api/trucks/${selectedTruck.id}`, {
                method: "PATCH",
                headers: authHeaders(token!),
                body: JSON.stringify({ driver_id: driverId }),
              });
              if (!res.ok) throw new Error(await res.text());
              await fetchAll();
              setShowChangeDriverModal(false);
            } catch (err) {
              alert("Failed to update agent: " + (err instanceof Error ? err.message : String(err)));
            }
          }}
        />
      )}

      {showAddDeliveryModal && selectedTruck && (
        <AddDeliveryModal
          truck={selectedTruck}
          eligibleInvoices={eligibleInvoices}
          customers={customers}
          onClose={() => setShowAddDeliveryModal(false)}
          onSave={handleCreateDelivery}
        />
      )}
    </div>
  );
}

// ─── Add New Truck Modal ──────────────────────────────────────────────────────

function AddTruckModal({ drivers, token, onClose, onCreated }: {
  drivers: Driver[]; token: string; onClose: () => void; onCreated: () => Promise<void>;
}) {
  const [truckName, setTruckName]           = useState("");
  const [truckDistrict, setTruckDistrict]   = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [truckStatus, setTruckStatus]       = useState<"available" | "in_transit" | "maintenance">("available");
  const [saving, setSaving]                 = useState(false);

  const handleSave = async () => {
    if (!truckName || !truckDistrict) { alert("Fill in truck name and district."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: truckName, district: truckDistrict, driver_id: selectedDriverId || undefined, status: truckStatus }),
      });
      if (!res.ok) throw new Error(await res.text());
      await onCreated();
    } catch (err) {
      alert("Failed to add truck: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Add New Truck" onClose={onClose}>
      <div className="space-y-4">
        {[
          { label: "Truck Name *", value: truckName, onChange: setTruckName, placeholder: "e.g., Truck A" },
          { label: "District *",   value: truckDistrict, onChange: setTruckDistrict, placeholder: "e.g., Metro Manila" },
        ].map(({ label, value, onChange, placeholder }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-navy mb-1">{label}</label>
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Status</label>
          <select value={truckStatus} onChange={(e) => setTruckStatus(e.target.value as any)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
            <option value="available">Available</option>
            <option value="in_transit">In Transit</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-navy mb-1">Assign Agent (Optional)</label>
          <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
            <option value="">No agent assigned</option>
            {drivers.filter((d) => d.is_active).map((d) => (
              <option key={d.id} value={d.id}>{d.full_name || d.id.slice(0, 8)}{d.contact_info && ` — ${d.contact_info}`}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-off-white">Cancel</button>
        <button onClick={handleSave} disabled={!truckName || !truckDistrict || saving}
          className="px-4 py-2 bg-accent-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? "Adding…" : "Add Truck"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Change Driver Modal ──────────────────────────────────────────────────────

function ChangeDriverModal({ truck, drivers, token, onClose, onSave }: {
  truck: Truck; drivers: Driver[]; token: string; onClose: () => void; onSave: (id: string) => Promise<void>;
}) {
  const [selectedDriverId, setSelectedDriverId] = useState(truck.driver_id || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedDriverId) { alert("Please select an agent"); return; }
    setSaving(true);
    try { await onSave(selectedDriverId); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Change Agent — ${truck.name}`} onClose={onClose}>
      <div>
        <label className="block text-xs font-semibold text-navy mb-2">Select Agent *</label>
        <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent-2">
          <option value="">Choose an agent…</option>
          {drivers.filter((d) => d.is_active).map((d) => (
            <option key={d.id} value={d.id}>{d.full_name || d.id.slice(0, 8)}{d.contact_info && ` — ${d.contact_info}`}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-off-white">Cancel</button>
        <button onClick={handleSave} disabled={!selectedDriverId || saving}
          className="px-4 py-2 bg-accent-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? "Updating…" : "Change Agent"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Add Delivery Modal ────────────────────────────────────────────────────────

function AddDeliveryModal({ truck, eligibleInvoices, customers, onClose, onSave }: {
  truck: Truck; eligibleInvoices: Invoice[]; customers: Customer[];
  onClose: () => void; onSave: (d: { invoice_id: string; destination_customer_id: string }[]) => Promise<void>;
}) {
  const [stops, setStops] = useState([{ invoice_id: "", destination_customer_id: "" }]);
  const [saving, setSaving] = useState(false);

  const addStop    = () => setStops((s) => [...s, { invoice_id: "", destination_customer_id: "" }]);
  const removeStop = (i: number) => setStops((s) => s.filter((_, idx) => idx !== i));
  const updateStop = (i: number, field: "invoice_id" | "destination_customer_id", val: string) =>
    setStops((s) => s.map((stop, idx) => idx === i ? { ...stop, [field]: val } : stop));

  const valid = stops.every((s) => s.invoice_id && s.destination_customer_id);

  const handleSave = async () => {
    if (!valid) { alert("Fill in all stops."); return; }
    setSaving(true);
    try { await onSave(stops); }
    finally { setSaving(false); }
  };

  return (
    <ModalShell title={`Add Delivery — ${truck.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-navy">Delivery Stops *</label>
          <button onClick={addStop} className="text-xs text-accent-2 font-semibold hover:opacity-80">+ Add Stop</button>
        </div>
        {stops.map((stop, i) => (
          <div key={i} className="bg-off-white rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-navy">Stop {i + 1}</p>
              {stops.length > 1 && (
                <button onClick={() => removeStop(i)} className="text-xs text-red hover:opacity-70">✕ Remove</button>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Invoice (issued & unpaid)</label>
              <select value={stop.invoice_id} onChange={(e) => updateStop(i, "invoice_id", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent-2 bg-white">
                <option value="">Select invoice…</option>
                {eligibleInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>{inv.id.slice(0, 8)}… — {inv.status} / {inv.payment_status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Destination Customer</label>
              <select value={stop.destination_customer_id} onChange={(e) => updateStop(i, "destination_customer_id", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs focus:outline-none focus:border-accent-2 bg-white">
                <option value="">Select customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.store_name} — {c.location}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-off-white">Cancel</button>
        <button onClick={handleSave} disabled={!valid || saving}
          className="px-4 py-2 bg-accent-2 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {saving ? "Saving…" : "Add Delivery"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl border border-border w-full sm:max-w-lg max-h-[90vh] flex flex-col">
        <div className="bg-navy-mid px-5 py-4 flex items-center justify-between border-b border-border rounded-t-2xl flex-shrink-0">
          <h2 className="font-rajdhani text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white hover:opacity-70 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4 flex-1">{children}</div>
      </div>
    </div>
  );
}
