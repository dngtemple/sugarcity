import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useAuth } from './stores/auth';
import { StudioLoader } from './components/shell/Brand';

/** Checks the saved session with the API once, then hands over to the router. */
export function App() {
  const ready = useAuth((s) => s.ready);
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return ready ? <RouterProvider router={router} /> : <StudioLoader />;
}
