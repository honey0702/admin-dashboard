import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { AppProvider } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { BootSkeleton } from './components/BootSkeleton';
import Overview from './pages/Overview';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import NewSale from './pages/NewSale';
import HomeDelivery from './pages/HomeDelivery';
import Expenses from './pages/Expenses';
import DailySummary from './pages/DailySummary';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

/** Gentle page transition — fade + 10px rise, ~250ms, reduced-motion aware. */
function PageTransition({ children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Overview /></PageTransition>} />
        <Route path="/inventory" element={<PageTransition><Inventory /></PageTransition>} />
        <Route path="/sales" element={<PageTransition><Sales /></PageTransition>} />
        <Route path="/sales/new" element={<PageTransition><NewSale /></PageTransition>} />
        <Route path="/home-delivery" element={<PageTransition><HomeDelivery /></PageTransition>} />
        <Route path="/expenses" element={<PageTransition><Expenses /></PageTransition>} />
        <Route path="/daily-summary" element={<PageTransition><DailySummary /></PageTransition>} />
        <Route path="/analytics" element={<PageTransition><Analytics /></PageTransition>} />
        <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function BootedApp() {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.995 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="h-full">
      <HashRouter>
        <AppLayout>
          <AnimatedRoutes />
        </AppLayout>
      </HashRouter>
    </motion.div>
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 650);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        {booted ? <BootedApp /> : <BootSkeleton />}
      </AppProvider>
    </MotionConfig>
  );
}
