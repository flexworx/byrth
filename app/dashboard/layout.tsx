'use client'

import { useState, useEffect } from 'react'
import { AuthContext, useAuthProvider } from '@/hooks/useAuth'
import { ThemeContext, useThemeProvider } from '@/hooks/useTheme'
import { DashboardSidebar } from '@/components/dashboard/layout/DashboardSidebar'
import { DashboardHeader } from '@/components/dashboard/layout/DashboardHeader'
import { LoginPage } from '@/components/dashboard/LoginPage'
import { ToastProvider } from '@/components/ui/Toast'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const auth = useAuthProvider()
  const themeState = useThemeProvider()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for client hydration before rendering auth-dependent UI
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-nexgen-bg items-center justify-center">
        <div className="animate-pulse text-nexgen-muted text-sm font-mono">Loading platform...</div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={auth}>
      <ThemeContext.Provider value={themeState}>
        {auth.isAuthenticated ? (
          <ToastProvider>
            <div className="flex min-h-screen bg-nexgen-bg">
              <DashboardSidebar
                mobileOpen={sidebarOpen}
                onMobileClose={() => setSidebarOpen(false)}
              />
              <div className="flex-1 lg:ml-64">
                <DashboardHeader
                  title="HSE Operations Center"
                  onMenuToggle={() => setSidebarOpen((v) => !v)}
                />
                <main className="p-4 lg:p-6">
                  <Breadcrumbs />
                  {children}
                </main>
              </div>
            </div>
            <CommandPalette />
            <KeyboardShortcutsModal />
          </ToastProvider>
        ) : (
          <LoginPage />
        )}
      </ThemeContext.Provider>
    </AuthContext.Provider>
  )
}
