import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { GuestOnly, RequireAuth } from './components/shell/Guards';
import { StudioShell } from './components/shell/StudioShell';
import { StudioLoader } from './components/shell/Brand';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';

export const router = createBrowserRouter([
  {
    element: <Outlet />,
    HydrateFallback: () => <StudioLoader />,
    children: [
      { path: '/login', element: <GuestOnly><LoginPage /></GuestOnly> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        // Print page: no sidebar, no top bar.
        path: '/inventory/labels',
        lazy: async () => {
          const { LabelsPage } = await import('./pages/stock/LabelsPage');
          return { element: <RequireAuth><LabelsPage /></RequireAuth> };
        },
      },
      {
        element: (
          <RequireAuth>
            <StudioShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', lazy: async () => ({ Component: (await import('./pages/OrderPage')).OrderPage }) },
          { path: 'pos', lazy: async () => ({ Component: (await import('./pages/PosPage')).PosPage }) },
          { path: 'sales', lazy: async () => ({ Component: (await import('./pages/SalesPage')).SalesPage }) },
          { path: 'menu', lazy: async () => ({ Component: (await import('./pages/MenuPage')).MenuPage }) },
          {
            path: 'menu/:id',
            lazy: async () => ({ Component: (await import('./pages/MenuEditorPage')).MenuEditorPage }),
          },
          {
            path: 'inventory',
            lazy: async () => ({ Component: (await import('./pages/stock/StockPage')).StockPage }),
          },
          {
            path: 'inventory/history',
            lazy: async () => ({ Component: (await import('./pages/stock/StockHistoryPage')).StockHistoryPage }),
          },
          { path: 'settings', lazy: async () => ({ Component: (await import('./pages/SettingsPage')).SettingsPage }) },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
