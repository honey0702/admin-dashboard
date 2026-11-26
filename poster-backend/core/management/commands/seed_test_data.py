"""Layer a richer, deterministic test dataset on top of `seed_demo`.

Run `python manage.py seed_demo` first (this command refuses to run twice on
the same database). Everything goes through the same service functions the
REST API uses, so stock ledger, COGS snapshots and document numbering stay
consistent:

  - reprint batches + damage entries on low / sold-out designs
  - ~90 extra sales spread over the last 90 days (Cash/UPI/Other, combo
    discounts, a few explicit discounts, 4 cancellations for the audit trail)
  - ~18 more expenses (one-time + recurring) over the last 90 days
  - ~10 home-delivery orders in every pipeline status, incl. delivered orders
    that create real linked sales

Never run against real data — it writes straight into the database.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.demo_seed import mulberry32
from core.models import DocumentCounter, next_expense_code
from delivery.models import Order
from delivery.services import create_order, transition_status
from expenses.models import Expense, ExpenseCategory
from inventory.models import Design, PrintBatch
from inventory.services import adjust_stock, apply_batch
from sales.models import Sale
from sales.services import SaleValidationError, cancel_sale, create_sale

User = get_user_model()

TEST_NOTE = 'TEST-PACK'

RESTOCK_TARGETS = ['D001', 'D002', 'D003', 'D004', 'D006', 'D008', 'D010', 'D014',
                   'D019', 'D020', 'D024', 'D026']

EXTRA_EXPENSES = [
    (2, 'Printing', 'A3 matte reprint run — 60 posters', 840, 'UPI', 'one-time'),
    (4, 'Marketing', 'Instagram story promo — weekend', 500, 'UPI', 'one-time'),
    (6, 'Rent', 'Stall rent — November', 3000, 'Bank', 'recurring'),
    (7, 'Packaging', 'Polybags + kraft envelopes restock', 320, 'Cash', 'one-time'),
    (9, 'Delivery charges', 'Tempo for delivery round — Adajan/Vesu', 280, 'UPI', 'one-time'),
    (11, 'Electricity', 'Extension board + bulb for evening stall', 150, 'Cash', 'recurring'),
    (13, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
    (15, 'Transportation', 'Auto to stall', 160, 'Cash', 'one-time'),
    (18, 'Poster purchasing', 'Lamination sheets for premium prints', 450, 'UPI', 'one-time'),
    (21, 'Miscellaneous', 'Marker pens + price tags', 120, 'Cash', 'one-time'),
    (24, 'Marketing', 'WhatsApp status ads', 200, 'UPI', 'one-time'),
    (27, 'Daily Stall Expenses', 'Water bottle refills', 80, 'Cash', 'recurring'),
    (31, 'Rent', 'Stall rent — October', 3000, 'Bank', 'recurring'),
    (33, 'Transportation', 'Weekend market transport', 450, 'UPI', 'one-time'),
    (38, 'Printing', 'Glossy photo paper restock', 620, 'UPI', 'one-time'),
    (44, 'Electricity', 'Phone charging cable for UPI speaker', 250, 'Cash', 'one-time'),
    (52, 'Delivery charges', 'Delivery round — Katargam/Athwa', 260, 'Cash', 'one-time'),
    (61, 'Rent', 'Stall rent — September', 3000, 'Bank', 'recurring'),
]

EXTRA_ORDERS = [
    # (customer, items, method, pay_mode, amount, pay_status, expected_days, final_status, note)
    (('Vraj Patel', '98765 11223', '12, Green Park Society', 'Adajan', '395009'), [('D001', 2), ('D014', 1)],
     'home-delivery', 'UPI', '180', 'paid', 1, 'delivered', 'Regular customer — leave at door'),
    (('Meera Shah', '90123 45678', '45, Ring Road', 'Ring Road', '395007'), [('D007', 1)],
     'home-delivery', 'UPI', '80', 'unpaid', 2, 'out-for-delivery', 'Call on arrival'),
    (('Karan Mehta', '99887 66554', '7, Lake View Homes', 'Piplod', '395002'), [('D023', 1), ('D025', 1)],
     'pickup', 'Cash', '160', 'unpaid', None, 'ready-pickup', 'Collect after 6 PM'),
    (('Anjali Rao', '91234 56789', 'B-12, Shree Tower', 'Athwa', '395001'), [('D011', 2)],
     'home-delivery', 'UPI', '160', 'paid', 3, 'delivered', ''),
    (('Suresh Gada', '90011 22334', '3, Mahidharpura', 'Mahidharpura', '395010'), [('D017', 1)],
     'home-delivery', 'Cash', '60', 'unpaid', 0, 'not-delivered', 'Gate locked — will retry tomorrow'),
    (('Pooja Jain', '98989 87676', '88, Adajan Gam', 'Adajan', '395009'), [('D026', 1)],
     'pickup', 'Cash', '120', 'unpaid', None, 'cancelled', 'Customer cancelled — budget issue'),
    (('Rahul Dave', '97654 32109', '21, City Light', 'Citylight', '395007'), [('D005', 1), ('D006', 1)],
     'home-delivery', 'UPI', '120', 'unpaid', 2, 'request-received', 'Birthday gift for nephew'),
    (('Nisha Verma', '90909 80808', '5, Vesu Gam', 'Vesu', '395007'), [('D009', 2)],
     'pickup', 'Cash', '120', 'unpaid', None, 'request-received', ''),
    (('Amit Solanki', '98111 22233', '34, Saroli', 'Saroli', '395003'), [('D027', 1)],
     'home-delivery', 'UPI', '100', 'paid', 1, 'request-received', 'Near the market gate'),
    (('Divya Chauhan', '99001 10101', '9, Pal', 'Pal', '395005'), [('D013', 1), ('D012', 1)],
     'home-delivery', 'UPI', '180', 'unpaid', 4, 'request-received', 'Wedding decoration order'),
]

CANCEL_REASONS = [
    'Customer changed mind — wrong size',
    'Duplicate bill entered by mistake',
    'Poster damaged before handover — refunded',
    'Customer walked away mid-bill',
]


def bump_counter(name, prefix):
    """Make sure a DocumentCounter is ahead of any manually numbered rows."""
    max_seq = 0
    if prefix == 'S':  # S-2026-0171
        year = timezone.now().year
        for n in Sale.objects.filter(number__startswith=f'S-{year}-').values_list('number', flat=True):
            try:
                max_seq = max(max_seq, int(n.rsplit('-', 1)[1]))
            except ValueError:
                pass
    elif prefix == 'HD':
        for n in Order.objects.values_list('number', flat=True):
            try:
                max_seq = max(max_seq, int(n.rsplit('-', 1)[1]))
            except ValueError:
                pass
    elif prefix == 'E':
        for n in Expense.objects.values_list('code', flat=True):
            try:
                max_seq = max(max_seq, int(n.rsplit('-', 1)[1]) - 1000)
            except ValueError:
                pass
    counter, _ = DocumentCounter.objects.get_or_create(name=name, defaults={'seq': 0})
    counter.seq = max(counter.seq, max_seq)
    counter.save(update_fields=['seq'])


@transaction.atomic
def seed_test_data():
    if Sale.objects.filter(note=TEST_NOTE).exists():
        raise CommandError('Test data already applied. Run `seed_demo` first to reset the database.')

    owner = User.objects.filter(role='owner').first() or User.objects.filter(is_superuser=True).first()
    if owner is None:
        raise CommandError('No owner account found. Run `seed_demo` first.')

    now = timezone.now()
    rng = mulberry32(13571113)

    bump_counter(f'sale-{now.year}', 'S')
    bump_counter('order', 'HD')
    bump_counter('expense', 'E')

    designs = {d.code: d for d in Design.objects.select_related('category')}

    # ---- 1) reprint batches on low / sold-out designs ----
    restocked = 0
    for code in RESTOCK_TARGETS:
        d = designs.get(code)
        if d is None:
            continue
        copies = 20 + int(rng() * 30)
        base_print = 14 if d.price >= 100 else 12 if d.price >= 80 else 10
        base_sleeve = Decimal('3') if d.price >= 100 else Decimal('2.5') if d.price >= 80 else Decimal('2')
        n_batches = PrintBatch.objects.filter(code__startswith=f'{code}-B').count()
        batch = PrintBatch.objects.create(
            code=f'{code}-B{n_batches + 1}',
            design=d,
            date=(now - timedelta(days=1 + int(rng() * 7))).date(),
            copies=copies,
            print_cost=Decimal(base_print + 1 + int(rng() * 3)),
            sleeve_cost=base_sleeve + Decimal('0.5'),
            note='Test-pack reprint',
        )
        apply_batch(batch)
        restocked += copies

    # ---- 2) a little damage ----
    damaged = 0
    for code, qty in (('D002', 1), ('D019', 2), ('D027', 1)):
        d = designs[code]
        if d.quantity <= qty:
            continue
        d.damaged_quantity += qty
        d.save(update_fields=['damaged_quantity', 'updated_at'])
        adjust_stock(d.id, -qty, 'damage', reference='damage',
                     note='Rain damage / torn corner — test pack', user=owner)
        damaged += qty

    # ---- 3) extra sales over the last 90 days ----
    sales_created, sales_skipped, cancelled = [], 0, 0
    for _ in range(110):
        day_back = int(rng() ** 1.25 * 90)
        dt = now - timedelta(days=day_back)
        dt = dt.replace(hour=9 + int(rng() * 12), minute=int(rng() * 60), second=0, microsecond=0)
        if dt > now:
            dt -= timedelta(days=1)
        # pick 1-4 distinct designs that currently have stock
        in_stock = [c for c, d in Design.objects.values_list('code', 'quantity') if d > 0]
        if not in_stock:
            break
        k = 1 if rng() < 0.55 else 2 if rng() < 0.8 else 3 if rng() < 0.95 else 4
        picks = rng_sample(rng, in_stock, min(k, len(in_stock)))
        lines = [{'design_code': c, 'qty': 1 if rng() < 0.7 else 2 if rng() < 0.92 else 3} for c in picks]
        roll = rng()
        payment = 'UPI' if roll < 0.55 else 'Cash' if roll < 0.9 else 'Other'
        if rng() < 0.8:
            discount = None  # let the combo rules decide
        else:
            discount = Decimal(str([0, 10, 20, 30][int(rng() * 4)]))
        try:
            sale = create_sale(lines=lines, payment=payment, note=TEST_NOTE,
                               discount=discount, created_by=owner, date=dt)
        except SaleValidationError:
            sales_skipped += 1
            continue
        sales_created.append(sale)

    # ---- 4) cancel a few old ones (audit trail + stock restore) ----
    old_sales = [s for s in sales_created if (now - s.date) > timedelta(days=2)]
    step = max(1, len(old_sales) // 4) if old_sales else 0
    for i, sale in enumerate(old_sales):
        if step and i % step == 0 and cancelled < 4:
            cancel_sale(sale, reason=CANCEL_REASONS[cancelled], created_by=owner)
            cancelled += 1

    # ---- 4b) push a few designs to sold-out / low so the alerts fire ----
    sold_down = 0
    for code, target_left in (('D004', 0), ('D006', 0), ('D024', 0), ('D009', 4), ('D011', 5)):
        d = Design.objects.get(code=code)
        sell = d.quantity - target_left
        if sell <= 0:
            continue
        try:
            create_sale(lines=[{'design_code': code, 'qty': sell}], payment='UPI', note=TEST_NOTE,
                        created_by=owner, date=now - timedelta(hours=2))
            sold_down += 1
        except SaleValidationError:
            pass

    # ---- 5) extra expenses ----
    expenses_created = 0
    for day_back, category, title, amount, mode, kind in EXTRA_EXPENSES:
        cat = ExpenseCategory.objects.filter(name__iexact=category).first()
        if cat is None:
            cat = ExpenseCategory.objects.create(name=category)
        dt = now - timedelta(days=day_back)
        dt = dt.replace(hour=11 + (day_back % 8), minute=int(rng() * 60), second=0, microsecond=0)
        Expense.objects.create(
            code=next_expense_code(), title=title, category=cat,
            amount=Decimal(amount), date=dt, mode=mode, kind=kind,
            note=TEST_NOTE, created_by=owner,
        )
        expenses_created += 1

    # ---- 6) extra orders across the whole pipeline ----
    orders_created = 0
    for cust, items, method, pay_mode, amount, pay_status, expected_days, final_status, note in EXTRA_ORDERS:
        name, phone, address, area, pin = cust
        order = create_order(
            customer={'name': name, 'phone': phone, 'address': address, 'area': area, 'city': 'Surat', 'pin': pin},
            items=[{'design_code': c, 'qty': q} for c, q in items],
            method=method, payment_mode=pay_mode,
            payment_amount=Decimal(amount), payment_status=pay_status,
            expected_date=(now + timedelta(days=expected_days)).date() if expected_days is not None else None,
            note=note, created_by=owner,
        )
        orders_created += 1
        if final_status and final_status != 'request-received':
            try:
                transition_status(order, final_status, note=f'Test pack → {final_status}', by=owner)
            except Exception:
                pass  # e.g. insufficient stock at fulfill time — stays request-received

    return {
        'restocked_copies': restocked,
        'damaged_copies': damaged,
        'sales_added': len(sales_created) + sold_down,
        'sales_skipped_no_stock': sales_skipped,
        'sales_cancelled': cancelled,
        'designs_sold_down': sold_down,
        'expenses_added': expenses_created,
        'orders_added': orders_created,
    }


def rng_sample(rng, pool, k):
    pool = list(pool)
    picks = []
    for _ in range(k):
        if not pool:
            break
        i = int(rng() * len(pool))
        picks.append(pool.pop(i))
    return picks


class Command(BaseCommand):
    help = 'Add a rich deterministic test pack on top of seed_demo (sales, expenses, orders, restocks, damage).'

    def handle(self, *args, **options):
        stats = seed_test_data()
        self.stdout.write(self.style.SUCCESS(
            'Test pack applied: {restocked_copies} copies restocked, {damaged_copies} damaged, '
            '{sales_added} sales added ({sales_cancelled} cancelled, {sales_skipped_no_stock} skipped for stock, '
            '{designs_sold_down} designs pushed to sold-out/low), {expenses_added} expenses, {orders_added} orders.'.format(**stats)
        ))
