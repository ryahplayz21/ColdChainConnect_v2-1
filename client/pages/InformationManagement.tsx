import { Routes, Route } from "react-router-dom";
import { HubSidebar } from "@/components/HubSidebar";
import { Pricing } from "./modules/Pricing";
import { Inventory } from "./Inventory";
import { Customers } from "./modules/Customers";
import { Drivers } from "./modules/Drivers";
import { Agents } from "./modules/Agents";
import { InventoryProvider } from "../context/InventoryContext";

const modules = [
  { label: "Pricing", path: "/pricing" },
  { label: "Inventory", path: "/inventory" },
  { label: "Customers", path: "/customers" },
  { label: "Agents", path: "/agents" },
  { label: "Drivers", path: "/drivers" },
];

export function InformationManagement() {
  return (
    <InventoryProvider>
      <div className="flex h-full">
        <HubSidebar modules={modules} basePath="/information-management" />
        <div className="flex-1 overflow-auto pb-20 md:pb-0">
          <Routes>
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/" element={<PricingDefault />} />
          </Routes>
        </div>
      </div>
    </InventoryProvider>
  );
}

function PricingDefault() {
  return <Pricing />;
}
