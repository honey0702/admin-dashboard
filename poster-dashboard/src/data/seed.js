/**
 * Realistic sample dataset for Rang Poster Co. — a poster-stall business in
 * Surat, India (stall-market fixture), seeded relative to "today" so every
 * view (Today / This week / This month) is always alive.
 *
 * The dataset is deterministic (fixed seed) and shaped exactly like the
 * future Django REST resources: designs with batch costing (print + sleeve),
 * line-item sales snapshots, one-time vs recurring expenses, and
 * home-delivery orders. Printing/sleeve costs live in inventory (COGS) and
 * are never double-counted as expenses.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const unitCostOfBatches = (batches) => {
  const copies = batches.reduce((a, b) => a + b.copies, 0);
  if (!copies) return 0;
  return batches.reduce((a, b) => a + b.copies * (b.printCost + b.sleeveCost), 0) / copies;
};

/* ---------- Design catalogue ----------
 * sold / remaining are tuned so the store genuinely shows low-stock and
 * sold-out designs on first load. planned = sold + remaining.
 * [id, name, category, price, soldTarget, remaining]
 */
const DESIGN_DEFS = [
  ['D001', 'Midnight Tokyo Skyline', 'Anime', 60, 19, 17],
  ['D002', 'Attack on Titan — Levi', 'Anime', 60, 33, 9],
  ['D003', 'Naruto — Sage Mode', 'Anime', 60, 24, 2],
  ['D004', 'One Piece — Wanted Poster', 'Anime', 60, 14, 0],
  ['D005', 'Retro Iron Man Mk-I', 'Superhero', 60, 15, 22],
  ['D006', 'Batman over Gotham', 'Superhero', 60, 21, 3],
  ['D007', 'Spider-Man — Across the Canvas', 'Superhero', 80, 11, 15],
  ['D008', 'Grand Prix — 917K Long Tail', 'Automotive', 60, 27, 1],
  ['D009', 'American Muscle Fastback', 'Automotive', 60, 17, 18],
  ['D010', 'Monte Carlo Rally — 1973', 'Automotive', 60, 25, 7],
  ['D011', 'Voyager Golden Record', 'Space & Science', 80, 16, 12],
  ['D012', 'Apollo 11 Mission Badge', 'Space & Science', 80, 13, 21],
  ['D013', 'Webb Deep Field Portrait', 'Space & Science', 100, 7, 26],
  ['D014', 'Santorini, Greece — 1960', 'Vintage Travel', 60, 20, 13],
  ['D015', 'Kyoto Railways — 1950s', 'Vintage Travel', 80, 9, 25],
  ['D016', 'The Alps by Express', 'Vintage Travel', 60, 15, 16],
  ['D017', 'Krishna Leela — Vintage Print', 'Mythology', 60, 12, 19],
  ['D018', 'Shiva Tandav Kalamkari', 'Mythology', 80, 5, 27],
  ['D019', 'Ganesha — Folk Art', 'Mythology', 60, 23, 8],
  ['D020', 'The Wall — Tour Poster, 1980', 'Music', 100, 8, 30],
  ['D021', 'Raag Malhar — Classical Series', 'Music', 80, 6, 28],
  ['D022', 'Woodstock 1969', 'Music', 100, 10, 22],
  ['D023', 'Bengal Tiger Portrait', 'Wildlife', 80, 14, 17],
  ['D024', 'Himalayan Snow Leopard', 'Wildlife', 100, 4, 0],
  ['D025', 'Asiatic Lion — Gir', 'Wildlife', 80, 11, 24],
  ['D026', 'Brutalist Mumbai — Limited', 'Architecture', 120, 3, 2],
  ['D027', 'Charminar, Hyderabad', 'Architecture', 100, 7, 29],
  ['D028', 'Monsoon Rains, Mumbai', 'Architecture', 100, 5, 33],
];

const DAMAGED = { D002: 1, D006: 1, D010: 1, D019: 2, D027: 1 };
const NOTES = {
  D013: 'Limited print run — deep-space catalogue',
  D020: 'Licensed reprint, check rights before reordering',
  D026: 'Numbered limited edition of 40',
  D004: 'Sold out — awaiting reprint quote',
};

function buildDesigns(now, rng) {
  return DESIGN_DEFS.map(([id, name, category, price, soldTarget, remaining]) => {
    const planned = soldTarget + remaining;
    const basePrint = price >= 100 ? 14 : price >= 80 ? 12 : 10;
    const baseSleeve = price >= 100 ? 3 : price >= 80 ? 2.5 : 2;
    const batches = [];
    if (planned < 22) {
      batches.push({
        id: `${id}-B1`,
        date: isoDaysAgo(now, 40 + Math.floor(rng() * 20)),
        copies: planned,
        printCost: basePrint + 2,
        sleeveCost: baseSleeve + 0.5,
        note: 'Reprint batch',
      });
    } else {
      const first = Math.round(planned * 0.55);
      batches.push({
        id: `${id}-B1`,
        date: isoDaysAgo(now, 88 + Math.floor(rng() * 14)),
        copies: first,
        printCost: basePrint,
        sleeveCost: baseSleeve,
        note: 'First print',
      });
      batches.push({
        id: `${id}-B2`,
        date: isoDaysAgo(now, 34 + Math.floor(rng() * 12)),
        copies: planned - first,
        printCost: basePrint + 2,
        sleeveCost: baseSleeve + 0.5,
        note: 'Reprint — rates increased',
      });
    }
    return {
      id,
      name,
      category,
      price,
      damaged: DAMAGED[id] || 0,
      notes: NOTES[id] || '',
      rights: category === 'Music' ? 'Licensed reprint' : 'Original artwork — rights cleared',
      archived: false,
      batches,
      createdAt: isoDaysAgo(now, 96),
      _soldTarget: soldTarget,
    };
  });
}

const isoDaysAgo = (now, days, hour = 12, minute = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

/* ---------- Sales ---------- */

function generateSales(designs, now) {
  const rng = mulberry32(20261123);
  const quotas = new Map(designs.map((d) => [d.id, d._soldTarget]));
  const sales = [];

  const takeDesign = (design, want) => {
    const have = quotas.get(design.id) || 0;
    const n = Math.min(have, want);
    quotas.set(design.id, have - n);
    return n;
  };

  const pushTxn = (dateObj) => {
    const active = designs.filter((d) => (quotas.get(d.id) || 0) > 0);
    if (!active.length) return false;
    const roll = rng();
    let lineCount = roll < 0.52 ? 1 : roll < 0.78 ? 2 : roll < 0.9 ? 3 : 4;
    lineCount = Math.min(lineCount, active.length);

    const pool = [...active];
    const picks = [];
    for (let i = 0; i < lineCount; i++) {
      const totalQ = pool.reduce((a, d) => a + quotas.get(d.id), 0);
      let r = rng() * totalQ;
      let chosen = pool[pool.length - 1];
      for (const d of pool) {
        r -= quotas.get(d.id);
        if (r <= 0) {
          chosen = d;
          break;
        }
      }
      picks.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    }

    const lines = [];
    let posterCount = 0;
    for (const d of picks) {
      const qRoll = rng();
      const want = qRoll < 0.72 ? 1 : qRoll < 0.92 ? 2 : 3;
      const qty = takeDesign(d, want);
      if (qty <= 0) continue;
      lines.push({
        designId: d.id,
        name: d.name,
        category: d.category,
        qty,
        unitPrice: d.price,
        unitCost: +unitCostOfBatches(d.batches).toFixed(2),
      });
      posterCount += qty;
    }
    if (!lines.length) return false;

    const gross = lines.reduce((a, l) => a + l.qty * l.unitPrice, 0);
    let discount = posterCount >= 5 ? 50 : posterCount >= 3 ? 40 : 0;
    if (discount === 0 && rng() < 0.12) discount = 10;
    if (rng() > 0.9) discount = 0; // occasional no-discount sale
    discount = Math.min(discount, gross);

    const payRoll = rng();
    const payment = payRoll < 0.52 ? 'UPI' : payRoll < 0.88 ? 'Cash' : 'Other';

    sales.push({
      id: '',
      date: dateObj.toISOString(),
      lines,
      gross,
      discount,
      net: gross - discount,
      payment,
      note: '',
      status: 'completed',
      createdAt: dateObj.toISOString(),
    });
    return true;
  };

  // Seed "today" with a believable spread of sales across the stall day so far
  // (8:00 → now). Sales are never stamped in the future, so time filters that
  // end at *now* always include them.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const openMin = 8 * 60;
  if (nowMin > openMin + 10) {
    const span = nowMin - openMin;
    const fractions = [0.06, 0.22, 0.37, 0.55, 0.74, 0.94];
    fractions.forEach((f) => {
      const t = Math.round(openMin + span * f + (rng() * 18 - 9));
      if (t < openMin || t >= nowMin) return;
      const d = new Date(now);
      d.setHours(Math.floor(t / 60), Math.floor(t % 60), 0, 0);
      pushTxn(d);
    });
  }

  // Historical transactions, skewed toward recent days (today is fully covered
  // by the forced batch above, so start from yesterday to avoid stamping the
  // seed hour onto "today").
  for (let guard = 0; guard < 400; guard++) {
    if (![...quotas.values()].some((q) => q > 0)) break;
    const dayBack = Math.floor(Math.pow(rng(), 1.45) * 61) + 1;
    const d = new Date(now);
    d.setDate(d.getDate() - dayBack);
    d.setHours(10 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);
    if (d.getTime() > now.getTime()) d.setTime(now.getTime() - 10 * 60 * 1000);
    pushTxn(d);
  }

  sales.sort((a, b) => new Date(a.date) - new Date(b.date));
  sales.forEach((s, i) => {
    s.id = `S-${new Date(s.date).getFullYear()}-${String(i + 1).padStart(4, '0')}`;
  });
  return sales;
}

/* ---------- Expenses ---------- */

const EXPENSE_DEFS = [
  [58, 'Table / Cloth / Banner', 'Stall table, printed cloth and banner', 2400, 'UPI', 'one-time'],
  [55, 'Display Folders', 'Initial set of 6 display folders', 1350, 'Cash', 'one-time'],
  [52, 'Launch Expenses', 'Stall inauguration — ribbon and snacks', 850, 'Cash', 'one-time'],
  [47, 'Transportation', 'First stock batch — auto + tempo', 350, 'UPI', 'one-time'],
  [44, 'Miscellaneous', 'Tape, scissors, marker box', 180, 'Cash', 'one-time'],
  [40, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'],
  [36, 'Transportation', 'Auto to stall', 150, 'Cash', 'one-time'],
  [33, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'],
  [30, 'Transportation', 'Weekend market transport', 450, 'UPI', 'one-time'],
  [29, 'Display Folders', 'Two folders — replacements', 450, 'Cash', 'one-time'],
  [26, 'Transportation', 'Auto to stall', 170, 'UPI', 'one-time'],
  [24, 'Launch Expenses', 'WhatsApp ads in local groups', 250, 'UPI', 'one-time'],
  [22, 'Daily Stall Expenses', 'Water bottle refills', 80, 'Cash', 'recurring'],
  [18, 'Miscellaneous', 'Packaging tape and staple pins', 140, 'Cash', 'one-time'],
  [15, 'Transportation', 'Auto back home', 150, 'Cash', 'one-time'],
  [12, 'Table / Cloth / Banner', 'Banner touch-up with logo', 400, 'UPI', 'one-time'],
  [9, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'],
  [7, 'Transportation', 'Auto to stall', 160, 'UPI', 'one-time'],
  [5, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'],
  [3, 'Transportation', 'Auto to stall (shared)', 120, 'Cash', 'one-time'],
  [1, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'],
];

function buildExpenses(now) {
  return EXPENSE_DEFS.map(([dayBack, category, description, amount, mode, kind], i) => ({
    id: `E-${String(1000 + i)}`,
    date: isoDaysAgo(now, dayBack, 11 + (i % 7)),
    category,
    description,
    amount,
    mode,
    kind,
    note: '',
    createdAt: isoDaysAgo(now, dayBack, 11 + (i % 7)),
  }));
}

export const EXPENSE_CATEGORIES = [
  'Table / Cloth / Banner',
  'Display Folders',
  'Transportation',
  'Daily Stall Expenses',
  'Launch Expenses',
  'Miscellaneous',
];

/* ---------- Home-delivery / customer orders ---------- */

function buildOrders(now) {
  const iso = (daysBack, hour = 18) => isoDaysAgo(now, daysBack, hour);
  return [
    {
      id: 'HD-0001', date: iso(0, 10), status: 'request-received',
      customer: { name: 'Kavya Joshi', phone: '98220 44117', address: 'B-42, Devdeep Township', area: 'Adajan', city: 'Surat', pin: '395009' },
      items: [{ designId: 'D013', qty: 1 }],
      method: 'Home Delivery', expectedDate: isoDaysInFuture(now, 4),
      payment: { mode: 'UPI', amount: 100, status: 'unpaid' },
      note: 'Call before delivery', history: [{ at: iso(0, 10), status: 'request-received' }],
    },
    {
      id: 'HD-0002', date: iso(0, 13), status: 'request-received',
      customer: { name: 'Rohan Desai', phone: '99789 21043', address: '503, River View Tower', area: 'Vesu', city: 'Surat', pin: '395007' },
      items: [{ designId: 'D011', qty: 1 }, { designId: 'D012', qty: 1 }],
      method: 'Customer Pickup', expectedDate: null,
      payment: { mode: 'Cash', amount: 160, status: 'unpaid' },
      note: '', history: [{ at: iso(0, 13), status: 'request-received' }],
    },
    {
      id: 'HD-0003', date: iso(1, 19), status: 'waiting-stock',
      customer: { name: 'Priya Nair', phone: '90990 55231', address: '7, Om Apartments, Athwa Lines', area: 'Athwa', city: 'Surat', pin: '395001' },
      items: [{ designId: 'D004', qty: 2 }],
      method: 'Home Delivery', expectedDate: isoDaysInFuture(now, 9),
      payment: { mode: 'UPI', amount: 120, status: 'paid' },
      note: 'Wants the One Piece wanted poster — call when reprint lands', history: [{ at: iso(1, 19), status: 'waiting-stock' }],
    },
    {
      id: 'HD-0004', date: iso(2, 20), status: 'waiting-stock',
      customer: { name: 'Aman Gupta', phone: '97235 80126', address: '12, Amar Residency', area: 'Dumas Road', city: 'Surat', pin: '395005' },
      items: [{ designId: 'D024', qty: 1 }],
      method: 'Home Delivery', expectedDate: null,
      payment: { mode: 'UPI', amount: 100, status: 'unpaid' },
      note: 'Snow leopard — promised to call on restock', history: [{ at: iso(2, 20), status: 'waiting-stock' }],
    },
    {
      id: 'HD-0005', date: iso(3, 17), status: 'ready-pickup',
      customer: { name: 'Sneha Patel', phone: '99094 11209', address: 'Stall area visit', area: 'Rander', city: 'Surat', pin: '395009' },
      items: [{ designId: 'D006', qty: 1 }],
      method: 'Customer Pickup', expectedDate: null,
      payment: { mode: 'Cash', amount: 60, status: 'unpaid' },
      note: 'Collecting on Sunday', history: [{ at: iso(3, 17), status: 'ready-pickup' }],
    },
    {
      id: 'HD-0006', date: iso(4, 15), status: 'out-for-delivery',
      customer: { name: 'Ishita Shah', phone: '95123 74860', address: 'B-1104, Surat One', area: 'Citylight', city: 'Surat', pin: '395007' },
      items: [{ designId: 'D020', qty: 1 }],
      method: 'Home Delivery', expectedDate: iso(0, 19),
      payment: { mode: 'UPI', amount: 100, status: 'paid' },
      note: 'Deliver after 6 PM', history: [{ at: iso(4, 15), status: 'out-for-delivery' }],
    },
    {
      id: 'HD-0007', date: iso(9, 18), status: 'not-delivered',
      customer: { name: 'Mihir Trivedi', phone: '81411 90334', address: '23, Laxmi Nagar Society', area: 'Katargam', city: 'Surat', pin: '395004' },
      items: [{ designId: 'D017', qty: 2 }],
      method: 'Home Delivery', expectedDate: iso(7, 18),
      payment: { mode: 'Cash', amount: 120, status: 'unpaid' },
      note: 'Two attempts, nobody home — retry this weekend', history: [{ at: iso(9, 18), status: 'out-for-delivery' }, { at: iso(7, 19), status: 'not-delivered' }],
    },
    {
      id: 'HD-0008', date: iso(12, 16), status: 'cancelled',
      customer: { name: 'Nandini Rao', phone: '94270 66871', address: '8, Jewel Apartments', area: 'Athwa', city: 'Surat', pin: '395001' },
      items: [{ designId: 'D022', qty: 1 }],
      method: 'Customer Pickup', expectedDate: null,
      payment: { mode: 'Cash', amount: 100, status: 'unpaid' },
      note: 'Changed mind — wanted the framed one instead', history: [{ at: iso(12, 16), status: 'cancelled' }],
    },
  ];
}

const isoDaysInFuture = (now, days, hour = 18) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/* ---------- Root seed ---------- */

export function seedState() {
  const now = new Date();
  const rng = mulberry32(987654321);

  const designs = buildDesigns(now, rng);
  const sales = generateSales(designs, now);
  const cleanDesigns = designs.map(({ _soldTarget, ...rest }) => rest);

  return {
    version: 1,
    meta: { seededAt: now.toISOString(), business: 'Rang Poster Co.' },
    settings: {
      businessName: 'Rang Poster Co.',
      ownerName: 'Aarav Mehta',
      ownerRole: 'Owner',
      phone: '+91 98765 43210',
      address: 'Stall 14, Saroli Market, Surat, Gujarat',
      defaultPrice: 60,
      lowStockThreshold: 5,
      breakEvenTarget: 25000,
      currency: 'INR',
    },
    categories: [...new Set(DESIGN_DEFS.map(([, , cat]) => cat))],
    designs: cleanDesigns,
    sales,
    expenses: buildExpenses(now),
    orders: buildOrders(now),
    rules: [
      { id: 'rule-3', qty: 3, save: 40, enabled: true },
      { id: 'rule-5', qty: 5, save: 50, enabled: true },
    ],
  };
}
