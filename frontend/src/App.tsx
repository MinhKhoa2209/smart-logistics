import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProductsPage from './pages/ProductsPage';
import WarehousesPage from './pages/WarehousesPage';
import InventoryPage from './pages/InventoryPage';
import StockMovementsPage from './pages/StockMovementsPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import TransferOrdersPage from './pages/TransferOrdersPage';
import ShipmentsPage from './pages/ShipmentsPage';
import CustomerOrdersPage from './pages/CustomerOrdersPage';
import ProductLotsPage from './pages/ProductLotsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PGFeaturesPage from './pages/PGFeaturesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/warehouses" element={<WarehousesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/movements" element={<StockMovementsPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/transfers" element={<TransferOrdersPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/customer-orders" element={<CustomerOrdersPage />} />
          <Route path="/lots" element={<ProductLotsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/pg-features" element={<PGFeaturesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
