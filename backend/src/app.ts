import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { healthCheck } from './config/database';
import { errorHandler, appContext } from './middleware';
import productsRoutes from './routes/products.routes';
import warehousesRoutes from './routes/warehouses.routes';
import inventoryRoutes from './routes/inventory.routes';
import stockMovementsRoutes from './routes/stockMovements.routes';
import purchaseOrdersRoutes from './routes/purchaseOrders.routes';
import transfersRoutes from './routes/transfers.routes';
import shipmentsRoutes from './routes/shipments.routes';
import customerOrdersRoutes from './routes/customerOrders.routes';
import auditLogsRoutes from './routes/auditLogs.routes';
import dashboardRoutes from './routes/dashboard.routes';
import productLotsRoutes from './routes/productLots.routes';
import pgFeaturesRoutes from './routes/pgFeatures.routes';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set app context (user_id) for audit triggers
app.use(appContext());

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  const dbHealthy = await healthCheck();
  const status = dbHealthy ? 'ok' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
  });
});

// API routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/warehouses', warehousesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/stock-movements', stockMovementsRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/customer-orders', customerOrdersRoutes);
app.use('/api/lots', productLotsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/pg-features', pgFeaturesRoutes);

// Global error handler (must be registered after all routes)
app.use(errorHandler);

export default app;
