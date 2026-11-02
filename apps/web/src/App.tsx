import ShipmentPage, { ShipmentCreatePage, ShipmentDetailPage } from "./ShipmentPage.js";
import InventoryPage from "./InventoryPage.js";
import { Menu, Package, PanelLeftClose, PanelLeftOpen, X, ReceiptText, Boxes, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";

import PartnerPage, {
  PartnerCreatePage,
  PartnerDetailPage,
  PartnerEditPage,
} from "./PartnerPage.js";
import ProductPage, {
  ProductCreatePage,
  ProductDetailPage,
  ProductEditPage,
} from "./ProductPage.js";
import WarehousePage, { WarehouseCreatePage, WarehouseDetailPage, WarehouseEditPage } from "./WarehousePage.js";

import PurchaseReceiptPage, { PurchaseReceiptCreatePage, PurchaseReceiptDetailPage } from "./PurchaseReceiptPage.js";

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const isSales = location.pathname.startsWith("/sales/");
  const isProcurement = location.pathname.startsWith("/procurement/");
  const isInventory = location.pathname.startsWith("/inventory/");
  const title = isSales ? "Pengiriman" : isInventory ? (location.pathname.endsWith("/movements") ? "Pergerakan Stok" : "Saldo Stok") : isProcurement ? "Penerimaan Pembelian" : location.pathname.startsWith("/master-data/products")
    ? "Produk"
    : location.pathname.startsWith("/master-data/partners")
      ? "Mitra"
      : "Gudang";

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const handleResize = () => {
      if (desktop.matches) drawerRef.current?.close();
    };
    desktop.addEventListener("change", handleResize);
    return () => {
      desktop.removeEventListener("change", handleResize);
    };
  }, []);

  return (
    <div className="erp-shell">
      <a href="#main-content" className="erp-skip">
        Lewati ke konten utama
      </a>
      <header className="erp-header">
        <button
          type="button"
          className="erp-icon-button erp-menu-button"
          aria-label="Buka menu navigasi"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            drawerRef.current?.showModal();
            setDrawerOpen(true);
          }}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <Link to="/master-data/warehouses" className="erp-brand">
          NYAWIT ERP
        </Link>
        <span className="erp-header-divider" aria-hidden="true" />
        <p className="erp-current-title">{title}</p>
      </header>

      <div className="erp-body">
        <aside
          className={`erp-sidebar${collapsed ? " erp-sidebar-collapsed" : ""}`}
        >
          <nav aria-label="Utama" className="erp-module-menu">
            <Link
              to="/master-data/products"
              className="erp-module-link"
              aria-current={isSales || isProcurement || isInventory ? undefined : "page"}
              aria-label="Data Master"
              title={collapsed ? "Data Master" : undefined}
            >
              <Package size={20} aria-hidden="true" />
              <span className={collapsed ? "sr-only" : undefined}>
                Data Master
              </span>
            </Link>
            <Link to="/procurement/purchase-receipts" className="erp-module-link"
              aria-current={isProcurement ? "page" : undefined} aria-label="Pembelian"
              title={collapsed ? "Pembelian" : undefined}>
              <ReceiptText size={20} aria-hidden="true" />
              <span className={collapsed ? "sr-only" : undefined}>Pembelian</span>
            </Link>
            <Link to="/inventory/balances" className="erp-module-link"
              aria-current={isInventory ? "page" : undefined} aria-label="Persediaan"
              title={collapsed ? "Persediaan" : undefined}>
              <Boxes size={20} aria-hidden="true" />
              <span className={collapsed ? "sr-only" : undefined}>Persediaan</span>
            </Link>
            <Link to="/sales/shipments" className="erp-module-link"
              aria-current={isSales ? "page" : undefined} aria-label="Penjualan"
              title={collapsed ? "Penjualan" : undefined}>
              <Truck size={20} aria-hidden="true" />
              <span className={collapsed ? "sr-only" : undefined}>Penjualan</span>
            </Link>
          </nav>
          <div className="erp-sidebar-footer">
            <button
              type="button"
              className="erp-collapse-button"
              aria-label={
                collapsed ? "Perluas menu samping" : "Ciutkan menu samping"
              }
              onClick={() => {
                setCollapsed(!collapsed);
              }}
            >
              {collapsed ? (
                <PanelLeftOpen size={20} aria-hidden="true" />
              ) : (
                <>
                  <PanelLeftClose size={20} aria-hidden="true" />
                  <span>Ciutkan</span>
                </>
              )}
            </button>
          </div>
        </aside>

        <main id="main-content" tabIndex={-1} className="erp-main">
          <nav aria-label={isSales ? "Navigasi Penjualan" : isInventory ? "Navigasi Persediaan" : isProcurement ? "Navigasi Pembelian" : "Navigasi Data Master"} className="erp-tabs">
            {isSales ? <NavLink to="/sales/shipments">Pengiriman</NavLink> : isInventory ? <>
              <NavLink to="/inventory/balances">Saldo Stok</NavLink>
              <NavLink to="/inventory/movements">Pergerakan Stok</NavLink>
            </> : isProcurement ? <NavLink to="/procurement/purchase-receipts">Penerimaan Pembelian</NavLink> : <>
              <NavLink to="/master-data/products">Produk</NavLink>
              <NavLink to="/master-data/partners">Mitra</NavLink>
              <NavLink to="/master-data/warehouses">Gudang</NavLink>
            </>}
          </nav>
          <Routes>
            <Route path="/sales/shipments" element={<ShipmentPage />} />
            <Route path="/sales/shipments/new" element={<ShipmentCreatePage />} />
            <Route path="/sales/shipments/:id" element={<ShipmentDetailPage />} />
            <Route path="/inventory/balances" element={<InventoryPage />} />
            <Route path="/inventory/movements" element={<InventoryPage movements />} />
            <Route path="/procurement/purchase-receipts" element={<PurchaseReceiptPage />} />
            <Route path="/procurement/purchase-receipts/new" element={<PurchaseReceiptCreatePage />} />
            <Route path="/procurement/purchase-receipts/:id" element={<PurchaseReceiptDetailPage />} />
            <Route path="/master-data/warehouses" element={<WarehousePage />} />
            <Route path="/master-data/warehouses/new" element={<WarehouseCreatePage />} />
            <Route path="/master-data/warehouses/:id" element={<WarehouseDetailPage />} />
            <Route path="/master-data/warehouses/:id/edit" element={<WarehouseEditPage />} />
            <Route path="/master-data/products" element={<ProductPage />} />
            <Route path="/master-data/products/new" element={<ProductCreatePage />} />
            <Route path="/master-data/products/:id" element={<ProductDetailPage />} />
            <Route path="/master-data/products/:id/edit" element={<ProductEditPage />} />
            <Route path="/master-data/partners" element={<PartnerPage />} />
            <Route path="/master-data/partners/new" element={<PartnerCreatePage />} />
            <Route path="/master-data/partners/:id" element={<PartnerDetailPage />} />
            <Route path="/master-data/partners/:id/edit" element={<PartnerEditPage />} />
            <Route
              path="/warehouses"
              element={<Navigate to="/master-data/warehouses" replace />}
            />
            <Route
              path="/products"
              element={<Navigate to="/master-data/products" replace />}
            />
            <Route
              path="/partners"
              element={<Navigate to="/master-data/partners" replace />}
            />
            <Route
              path="*"
              element={<Navigate to="/master-data/warehouses" replace />}
            />
          </Routes>
        </main>
      </div>

      <dialog
        ref={drawerRef}
        className="erp-drawer"
        aria-label="Menu navigasi utama"
        onClose={() => {
          setDrawerOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls =
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button, a[href]",
            );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX >= bounds.right ||
            event.clientY < bounds.top ||
            event.clientY >= bounds.bottom
          )
            drawerRef.current?.close();
        }}
      >
        <div className="erp-drawer-header">
          <span className="erp-brand">NYAWIT ERP</span>
          <button
            type="button"
            className="erp-icon-button"
            aria-label="Tutup menu navigasi"
            onClick={() => {
              drawerRef.current?.close();
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Utama (menu geser)" className="erp-module-menu">
          <Link
            to="/master-data/products"
            className="erp-module-link"
            aria-current={isSales || isProcurement || isInventory ? undefined : "page"}
            onClick={() => {
              drawerRef.current?.close();
            }}
          >
            <Package size={20} aria-hidden="true" />
            <span>Data Master</span>
          </Link>
          <Link to="/procurement/purchase-receipts" className="erp-module-link"
            aria-current={isProcurement ? "page" : undefined}
            onClick={() => drawerRef.current?.close()}>
            <ReceiptText size={20} aria-hidden="true" /><span>Pembelian</span>
          </Link>
          <Link to="/inventory/balances" className="erp-module-link"
            aria-current={isInventory ? "page" : undefined} onClick={() => drawerRef.current?.close()}>
            <Boxes size={20} aria-hidden="true" /><span>Persediaan</span>
          </Link>
          <Link to="/sales/shipments" className="erp-module-link"
            aria-current={isSales ? "page" : undefined} onClick={() => drawerRef.current?.close()}>
            <Truck size={20} aria-hidden="true" /><span>Penjualan</span>
          </Link>
        </nav>
      </dialog>
    </div>
  );
}
