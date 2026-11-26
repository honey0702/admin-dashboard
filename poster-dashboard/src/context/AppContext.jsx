import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, api } from '../lib/api';
import { suggestedDiscount } from '../lib/finance';
import { seedState } from '../data/seed';

const AppContext = createContext(null);
const tokenKey = 'rang-poster-co:token';
const refreshKey = 'rang-poster-co:refresh';
const demoKey = 'rang-poster-co:v1';
// VITE_DEMO_MODE=true builds a standalone, fully offline preview: seed data in
// localStorage, no backend, no login. Never set in normal dev/prod builds.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const initial = {version:1, designs:[], sales:[], expenses:[], orders:[], rules:[], categories:[], settings:{}};
const dateOnly = d => d ? String(d).slice(0,10) : null;

export function AppProvider({ children }) {
  const [state, setState] = useState(initial);
  const [signedIn, setSignedIn] = useState(() => DEMO_MODE || !!localStorage.getItem(tokenKey));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const dismissToast = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  const pushToast = useCallback((type, title, sub) => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-2), {id,type,title,sub}]);
    setTimeout(() => dismissToast(id), 6000);
  }, [dismissToast]);

  const reload = useCallback(async () => {
    if (DEMO_MODE) {
      // Offline standalone build: restore the local snapshot, or seed fresh demo data.
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(demoKey) || 'null'); } catch { saved = null; }
      setState(saved && Array.isArray(saved.designs) && saved.designs.length ? { ...initial, ...saved } : seedState());
      return;
    }
    const [snapshot, designs, expenseCategories] = await Promise.all([apiFetch('/backup/export/'), api.inventory.list(), apiFetch('/expense-categories/')]);
    snapshot.expenseCategories = expenseCategories.filter(c => c.is_active).map(c => c.name);
    const stock = new Map(designs.map(d => [d.id, d]));
    snapshot.designs = snapshot.designs.map(d => ({...d, quantity:stock.get(d.id)?.quantity, avgCost:stock.get(d.id)?.avg_cost}));
    setState(snapshot);
  }, []);
  // Offline demo mode persists to localStorage so the standalone file behaves like the app.
  useEffect(() => {
    if (DEMO_MODE && state.designs.length) {
      try { localStorage.setItem(demoKey, JSON.stringify(state)); } catch { /* storage full/blocked — ignore */ }
    }
  }, [state]);
  useEffect(() => {
    const expire = () => {setSignedIn(false); setState(initial); setError('Session expired. Please sign in again.');};
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, []);
  useEffect(() => {
    if (!signedIn) {setLoading(false); return;}
    setLoading(true);
    reload().then(() => setError('')).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [signedIn, reload]);
  const login = async (username, password) => {
    setError(''); setLoading(true);
    try { const result = await api.auth.login(username, password); localStorage.setItem(tokenKey,result.access); localStorage.setItem(refreshKey,result.refresh); setSignedIn(true); }
    catch(e) {setError(e.message); setLoading(false);}
  };
  const logout = async () => {
    if (DEMO_MODE) return; // standalone preview stays signed in
    try { await api.auth.logout(localStorage.getItem(refreshKey)); } catch { /* clear local session regardless */ }
    localStorage.removeItem(tokenKey); localStorage.removeItem(refreshKey); setSignedIn(false); setState(initial);
  };
  // Return null on errors; callers must not report success when no value was returned.
  const mutate = useCallback(async (fn) => {
    if (DEMO_MODE) {
      pushToast('warning', 'Read-only preview', 'This standalone build runs on demo data — connect the backend to save changes.');
      return null;
    }
    let result;
    try { result = await fn(); }
    catch (e) { pushToast('warning', 'Could not save', e.message); return null; }
    try { await reload(); } catch (e) { pushToast('warning', 'Saved, but refresh failed', 'Reload the page before making more changes. ' + e.message); }
    return result ?? true;
  }, [reload, pushToast]);
  const call = (path, method, body) => apiFetch(path, {method, body});
  const actions = {
    addSale: data => mutate(() => api.sales.create({lines:data.lines.map(l=>({design_code:l.designId,qty:l.qty})), payment:data.payment, note:data.note, discount:data.discount})),
    cancelSale: (id,reason) => mutate(() => api.sales.cancel(id,reason)),
    addDesign: d => mutate(() => api.inventory.create({code:d.id || undefined,name:d.name,category:d.category,price:d.price,initial_copies:Number(d.copies),print_cost:d.printCost,sleeve_cost:d.sleeveCost,notes:d.notes,rights:d.rights})),
    updateDesign: (id,d) => mutate(() => api.inventory.update(id,d)),
    archiveDesign: id => mutate(() => api.inventory.archive(id)),
    addBatch: (id,b) => mutate(() => api.inventory.addBatch(id,{copies:b.copies,print_cost:b.printCost,sleeve_cost:b.sleeveCost,date:dateOnly(b.date),note:b.note})),
    recordDamage: (id,d) => mutate(() => api.inventory.damage(id,{quantity:d.qty,note:d.reason})),
    addExpense: d => mutate(() => api.expenses.create({...d,title:d.description})),
    updateExpense: (id,d) => mutate(() => api.expenses.update(id,{...d,title:d.description})),
    deleteExpense: id => mutate(() => api.expenses.remove(id)),
    addOrder: d => mutate(() => api.orders.create({customer:d.customer,items:d.items.map(i=>({design_code:i.designId,qty:i.qty})),method:d.method,expected_date:dateOnly(d.expectedDate),payment_mode:d.payment.mode,payment_amount:d.payment.amount,payment_status:d.payment.status,note:d.note})),
    updateOrder: (id,d) => mutate(() => api.orders.update(id,d)),
    setOrderStatus: (id,status) => mutate(() => api.orders.setStatus(id,status)),
    fulfillOrder: id => mutate(async () => {const o = await api.orders.setStatus(id,'delivered'); return o.linked_sale || o.id;}),
    addCategory: name => mutate(() => call('/categories/','POST',{name})),
    renameCategory: (oldName,name) => mutate(async () => {const cats=await call('/categories/'); const cat=cats.find(c=>c.name===oldName); if(!cat) throw Error('Category not found'); return call(`/categories/${cat.id}/`,'PATCH',{name});}),
    addRule: d => mutate(() => api.discountRules.create({min_qty:d.qty,save_amount:d.save,enabled:true})),
    updateRule: (id,d) => mutate(async () => {const rules=await api.discountRules.list(); const rule=rules.find(r=>`rule-${r.min_qty}`===id); if(!rule) throw Error('Rule not found'); return api.discountRules.update(rule.id,d);}),
    deleteRule: id => mutate(async () => {const rules=await api.discountRules.list(); const rule=rules.find(r=>`rule-${r.min_qty}`===id); if(!rule) throw Error('Rule not found'); return api.discountRules.remove(rule.id);}),
    updateSettings: d => mutate(() => {const mapping={businessName:'business_name',ownerName:'owner_name',ownerRole:'owner_role',defaultPrice:'default_price',defaultPayment:'default_payment',lowStockThreshold:'low_stock_threshold',breakEvenTarget:'break_even_target'}; return call('/settings/','PATCH',Object.fromEntries(Object.entries(d).map(([k,v])=>[mapping[k]||k,v])));}),
    importBackup: json => mutate(() => call('/backup/import/','POST', typeof json === 'string' ? JSON.parse(json) : json)),
    resetDemoData: () => mutate(() => call('/demo/reset/','POST',{})),
  };
  const value = {state,toasts,pushToast,dismissToast,...actions,logout};
  if (!signedIn) return <Login onLogin={login} loading={loading} error={error}/>;
  if (loading && !state.designs.length) return <div className="p-8">Loading business data…</div>;
  if (error && !state.designs.length) return <div className="p-8">Could not load business data: {error} <button onClick={logout}>Sign out</button> <button onClick={() => {setLoading(true);reload().then(()=>setError('')).catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>Retry</button></div>;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
function Login({onLogin,loading,error}) {
  const [username,setUsername]=useState(''); const [password,setPassword]=useState('');
  return <main className="min-h-screen bg-paper flex items-center justify-center p-5"><form className="w-full max-w-sm rounded-2xl bg-white border border-line p-7 shadow-sm space-y-4" onSubmit={e=>{e.preventDefault();onLogin(username,password);}}><div><h1 className="text-2xl font-semibold">Rang Poster Co.</h1><p className="text-muted text-sm">Sign in to your business dashboard</p></div><label className="block">Username<input className="field mt-1" value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required /></label><label className="block">Password<input className="field mt-1" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required /></label>{error && <p role="alert" className="text-red-700 text-sm">{error}</p>}<button className="w-full rounded-lg bg-primary text-white p-3" disabled={loading}>{loading?'Signing in…':'Sign in'}</button></form></main>;
}
export function useApp(){const ctx=useContext(AppContext);if(!ctx) throw new Error('useApp must be used inside AppProvider');return ctx;}
export { suggestedDiscount };
export const orderStatusMeta = {
  'request-received': { label: 'Request Received', tone: 'neutral' }, 'waiting-stock': { label: 'Waiting for Stock', tone: 'warning' },
  'ready-pickup': { label: 'Ready for Pickup', tone: 'primary' }, 'out-for-delivery': { label: 'Out for Delivery', tone: 'primary' },
  delivered: { label: 'Delivered', tone: 'success' }, 'not-delivered': { label: 'Not Delivered', tone: 'danger' }, cancelled: { label: 'Cancelled', tone: 'muted' },
};
