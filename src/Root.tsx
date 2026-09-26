import { lazy, Suspense } from 'react'

// Each route is its own lazy bundle, and — just as important as the download size — its own
// module graph: a plain `import App from './App.tsx'` runs App's entire import chain (Lenis,
// GSAP, three.js) immediately on evaluation, even if <App/> is never rendered. Lenis in
// particular self-attaches on construction and hijacks the page's wheel/touch scroll to replace
// it with its own — but its update loop only starts inside App's own effect, so on /admin that
// left scrolling permanently captured and never advanced. Lazy-loading both sides keeps their
// module graphs from ever touching each other.
const App = lazy(() => import('./App.tsx'))
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))
const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname)

export function Root() {
  return <Suspense fallback={null}>{isAdminRoute ? <AdminApp /> : <App />}</Suspense>
}
