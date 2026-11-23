import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileActionBar } from './MobileActionBar';
import { ToastViewport } from '../Toast';
import { CommandPalette } from '../CommandPalette';

export function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem('rang-poster-co:sidebar') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem('rang-poster-co:sidebar', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]', collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]')}>
        <Header onOpenMobileNav={() => setMobileOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6">
          {children}
        </main>
      </div>

      <MobileActionBar />
      <ToastViewport />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
