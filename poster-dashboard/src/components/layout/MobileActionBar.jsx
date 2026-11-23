import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Permanent thumb-reach actions on phones & small tablets.
 * On laptop the same actions live in the header.
 */
export function MobileActionBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (pathname === '/sales/new') return null; // the screen itself is the action
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/92 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg gap-2 px-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/sales/new')}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[0.92rem] font-semibold text-white shadow-sm transition-colors hover:bg-primary-2"
        >
          <Plus size={18} strokeWidth={2.5} /> New Sale
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/home-delivery', { state: { newOrder: true } })}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink text-[0.92rem] font-semibold text-white shadow-sm transition-colors hover:bg-[#26332C]"
        >
          <Truck size={17} strokeWidth={2.1} /> Home Delivery
        </motion.button>
      </div>
    </div>
  );
}
