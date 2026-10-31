import { NavLink, Navigate, Route, Routes } from 'react-router';

import PartnerPage from './PartnerPage.js';
import ProductPage from './ProductPage.js'
import WarehousePage from "./WarehousePage.js";

const navLinkClassName = ({ isActive }: { isActive: boolean }) => (isActive ? 'font-semibold underline' : '');

export default function App() {
  return (
    <div>
      <nav className="border-b border-gray-300 bg-gray-50">
        <div className="mx-auto flex max-w-3xl gap-4 p-3 text-sm">
          <NavLink to="/warehouses" className={navLinkClassName}>
            Gudang
          </NavLink>
          <NavLink to="/products" className={navLinkClassName}>
            Produk
          </NavLink>
          <NavLink to="/partners" className={navLinkClassName}>
            Partner
          </NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/warehouses" element={<WarehousePage />} />
        <Route path="/products" element={<ProductPage />} />
        <Route path="/partners" element={<PartnerPage />} />
        <Route path="*" element={<Navigate to="/warehouses" replace />} />
      </Routes>
    </div>
  );
}
