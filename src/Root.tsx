import { lazy, Suspense } from 'react'
import App from './App.tsx'

// The moderation page is its own bundle, so visitors to the site never download it.
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))
const isAdminRoute = /^\/admin\/?$/.test(window.location.pathname)

export function Root() {
  if (!isAdminRoute) return <App />
  return (
    <Suspense fallback={null}>
      <AdminApp />
    </Suspense>
  )
}
