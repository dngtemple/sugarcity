import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import HomePage from './pages/HomePage';
import MenuPage from './pages/MenuPage';
import ProductDialog from './pages/ProductDialog';
import { SECTIONS } from './lib/menu';

const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderPage = lazy(() => import('./pages/OrderPage'));
const TrackPage = lazy(() => import('./pages/TrackPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <span className="size-10 animate-spin rounded-full border-4 border-plum-100 border-t-plum" />
    </div>
  );
}

const lazyPage = (Page: React.ComponentType) => (
  <Suspense fallback={<PageLoading />}>
    <Page />
  </Suspense>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="menu" element={<Navigate to={`/menu/${SECTIONS[0]}`} replace />} />
          <Route path="menu/:section" element={<MenuPage />}>
            <Route path=":itemId" element={<ProductDialog />} />
          </Route>
          <Route path="checkout" element={lazyPage(CheckoutPage)} />
          <Route path="order/:number" element={lazyPage(OrderPage)} />
          <Route path="track" element={lazyPage(TrackPage)} />
          <Route path="track/:number" element={lazyPage(TrackPage)} />
          <Route path="*" element={lazyPage(NotFoundPage)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
