"""Deterministic demo dataset for Rang Poster Co. (Python port of the frontend seed).

Used by `python manage.py seed_demo` and POST /api/demo/reset/.
"""
import math
import uuid
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from core.models import (
    Category, DiscountRule, ShopProfile, next_expense_code, next_order_number,
    next_sale_number, StockMovement, DocumentCounter,
)

User = get_user_model()


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def imul(x, y):
        result = (x * y) & 0xFFFFFFFF
        return result - 0x100000000 if result >= 0x80000000 else result

    def rng():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = imul(t ^ (t >> 15), 1 | t)
        t = (t + imul(t ^ (t >> 7), 61 | t)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return rng


DESIGN_DEFS = [
    ('D001', 'Midnight Tokyo Skyline', 'Anime', 60, 19, 17),
    ('D002', 'Attack on Titan — Levi', 'Anime', 60, 33, 9),
    ('D003', 'Naruto — Sage Mode', 'Anime', 60, 24, 2),
    ('D004', 'One Piece — Wanted Poster', 'Anime', 60, 14, 0),
    ('D005', 'Retro Iron Man Mk-I', 'Superhero', 60, 15, 22),
    ('D006', 'Batman over Gotham', 'Superhero', 60, 21, 3),
    ('D007', 'Spider-Man — Across the Canvas', 'Superhero', 80, 11, 15),
    ('D008', 'Grand Prix — 917K Long Tail', 'Automotive', 60, 27, 1),
    ('D009', 'American Muscle Fastback', 'Automotive', 60, 17, 18),
    ('D010', 'Monte Carlo Rally — 1973', 'Automotive', 60, 25, 7),
    ('D011', 'Voyager Golden Record', 'Space & Science', 80, 16, 12),
    ('D012', 'Apollo 11 Mission Badge', 'Space & Science', 80, 13, 21),
    ('D013', 'Webb Deep Field Portrait', 'Space & Science', 100, 7, 26),
    ('D014', 'Santorini, Greece — 1960', 'Vintage Travel', 60, 20, 13),
    ('D015', 'Kyoto Railways — 1950s', 'Vintage Travel', 80, 9, 25),
    ('D016', 'The Alps by Express', 'Vintage Travel', 60, 15, 16),
    ('D017', 'Krishna Leela — Vintage Print', 'Mythology', 60, 12, 19),
    ('D018', 'Shiva Tandav Kalamkari', 'Mythology', 80, 5, 27),
    ('D019', 'Ganesha — Folk Art', 'Mythology', 60, 23, 8),
    ('D020', 'The Wall — Tour Poster, 1980', 'Music', 100, 8, 30),
    ('D021', 'Raag Malhar — Classical Series', 'Music', 80, 6, 28),
    ('D022', 'Woodstock 1969', 'Music', 100, 10, 22),
    ('D023', 'Bengal Tiger Portrait', 'Wildlife', 80, 14, 17),
    ('D024', 'Himalayan Snow Leopard', 'Wildlife', 100, 4, 0),
    ('D025', 'Asiatic Lion — Gir', 'Wildlife', 80, 11, 24),
    ('D026', 'Brutalist Mumbai — Limited', 'Architecture', 120, 3, 2),
    ('D027', 'Charminar, Hyderabad', 'Architecture', 100, 7, 29),
    ('D028', 'Monsoon Rains, Mumbai', 'Architecture', 100, 5, 33),
]

DAMAGED = {'D002': 1, 'D006': 1, 'D010': 1, 'D019': 2, 'D027': 1}
NOTES = {
    'D013': 'Limited print run — deep-space catalogue',
    'D020': 'Licensed reprint, check rights before reordering',
    'D026': 'Numbered limited edition of 40',
    'D004': 'Sold out — awaiting reprint quote',
}
CATEGORIES = ['Anime', 'Superhero', 'Automotive', 'Space & Science', 'Vintage Travel',
              'Mythology', 'Music', 'Wildlife', 'Architecture']

EXPENSE_DEFS = [
    (58, 'Table / Cloth / Banner', 'Stall table, printed cloth and banner', 2400, 'UPI', 'one-time'),
    (55, 'Display Folders', 'Initial set of 6 display folders', 1350, 'Cash', 'one-time'),
    (52, 'Launch Expenses', 'Stall inauguration — ribbon and snacks', 850, 'Cash', 'one-time'),
    (47, 'Transportation', 'First stock batch — auto + tempo', 350, 'UPI', 'one-time'),
    (44, 'Miscellaneous', 'Tape, scissors, marker box', 180, 'Cash', 'one-time'),
    (40, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
    (36, 'Transportation', 'Auto to stall', 150, 'Cash', 'one-time'),
    (33, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
    (30, 'Transportation', 'Weekend market transport', 450, 'UPI', 'one-time'),
    (29, 'Display Folders', 'Two folders — replacements', 450, 'Cash', 'one-time'),
    (26, 'Transportation', 'Auto to stall', 170, 'UPI', 'one-time'),
    (24, 'Launch Expenses', 'WhatsApp ads in local groups', 250, 'UPI', 'one-time'),
    (22, 'Daily Stall Expenses', 'Water bottle refills', 80, 'Cash', 'recurring'),
    (18, 'Miscellaneous', 'Packaging tape and staple pins', 140, 'Cash', 'one-time'),
    (15, 'Transportation', 'Auto back home', 150, 'Cash', 'one-time'),
    (12, 'Table / Cloth / Banner', 'Banner touch-up with logo', 400, 'UPI', 'one-time'),
    (9, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
    (7, 'Transportation', 'Auto to stall', 160, 'UPI', 'one-time'),
    (5, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
    (3, 'Transportation', 'Auto to stall (shared)', 120, 'Cash', 'one-time'),
    (1, 'Daily Stall Expenses', 'Tea and water for stall', 60, 'Cash', 'recurring'),
]

EXPENSE_CATEGORY_DEFS = [
    'Poster purchasing', 'Printing', 'Packaging', 'Delivery charges', 'Rent', 'Electricity',
    'Marketing', 'Transportation', 'Table / Cloth / Banner', 'Display Folders',
    'Daily Stall Expenses', 'Launch Expenses', 'Miscellaneous', 'Other',
]

ORDER_DEFS = [
    ('HD-0001', 0, 10, 'request-received', ('Kavya Joshi', '98220 44117', 'B-42, Devdeep Township', 'Adajan', '395009'),
     [('D013', 1)], 'home-delivery', 4, 'UPI', 100, 'unpaid', 'Call before delivery'),
    ('HD-0002', 0, 13, 'request-received', ('Rohan Desai', '99789 21043', '503, River View Tower', 'Vesu', '395007'),
     [('D011', 1), ('D012', 1)], 'pickup', None, 'Cash', 160, 'unpaid', ''),
    ('HD-0003', 1, 19, 'waiting-stock', ('Priya Nair', '90990 55231', '7, Om Apartments, Athwa Lines', 'Athwa', '395001'),
     [('D004', 2)], 'home-delivery', 9, 'UPI', 120, 'paid', 'Wants the One Piece wanted poster — call when reprint lands'),
    ('HD-0004', 2, 20, 'waiting-stock', ('Aman Gupta', '97235 80126', '12, Amar Residency', 'Dumas Road', '395005'),
     [('D024', 1)], 'home-delivery', None, 'UPI', 100, 'unpaid', 'Snow leopard — promised to call on restock'),
    ('HD-0005', 3, 17, 'ready-pickup', ('Sneha Patel', '99094 11209', 'Stall area visit', 'Rander', '395009'),
     [('D006', 1)], 'pickup', None, 'Cash', 60, 'unpaid', 'Collecting on Sunday'),
    ('HD-0006', 4, 15, 'out-for-delivery', ('Ishita Shah', '95123 74860', 'B-1104, Surat One', 'Citylight', '395007'),
     [('D020', 1)], 'home-delivery', 0, 'UPI', 100, 'paid', 'Deliver after 6 PM'),
    ('HD-0007', 9, 18, 'not-delivered', ('Mihir Trivedi', '81411 90334', '23, Laxmi Nagar Society', 'Katargam', '395004'),
     [('D017', 2)], 'home-delivery', -2, 'Cash', 120, 'unpaid', 'Two attempts, nobody home — retry this weekend'),
    ('HD-0008', 12, 16, 'cancelled', ('Nandini Rao', '94270 66871', '8, Jewel Apartments', 'Athwa', '395001'),
     [('D022', 1)], 'pickup', None, 'Cash', 100, 'unpaid', 'Changed mind — wanted the framed one instead'),
]


def _dt(days_back, hour=12, minute=0, now=None):
    now = now or timezone.now()
    d = now - timedelta(days=days_back)
    return d.replace(hour=hour, minute=minute, second=0, microsecond=0)


def clear_business_data():
    from sales.models import Sale, SaleItem
    from expenses.models import Expense, ExpenseCategory
    from delivery.models import Order, OrderItem, OrderStatusHistory
    from inventory.models import Design, PrintBatch

    SaleItem.objects.all().delete()
    Sale.objects.all().delete()
    OrderStatusHistory.objects.all().delete()
    OrderItem.objects.all().delete()
    Order.objects.all().delete()
    Expense.objects.all().delete()
    StockMovement.objects.all().delete()
    PrintBatch.objects.all().delete()
    Design.objects.all().delete()
    ExpenseCategory.objects.all().delete()
    Category.objects.all().delete()
    DiscountRule.objects.all().delete()
    DocumentCounter.objects.all().delete()


@transaction.atomic
def seed(owner_username='aarav', owner_password='Owner@123', owner_name='Aarav Mehta'):
    from inventory.models import Design, PrintBatch
    from sales.models import Sale, SaleItem
    from expenses.models import Expense, ExpenseCategory
    from delivery.models import Order, OrderItem, OrderStatusHistory

    now = timezone.now()
    clear_business_data()

    # ---- users ----
    owner = User.objects.filter(is_superuser=True).first() or User.objects.filter(role='owner').first()
    if owner is None:
        first, *rest = (owner_name or 'Owner').split(' ', 1)
        owner = User.objects.create_user(
            username=owner_username, password=owner_password,
            first_name=first, last_name=rest[0] if rest else '',
            role='owner', is_staff=True, is_superuser=True,
        )

    # ---- settings singleton ----
    ShopProfile.objects.all().delete()
    profile = ShopProfile(pk=1)
    profile.business_name = 'Rang Poster Co.'
    profile.owner_name = owner_name
    profile.owner_role = 'Owner'
    profile.phone = '+91 98765 43210'
    profile.address = 'Stall 14, Saroli Market, Surat, Gujarat'
    profile.default_price = Decimal('60')
    profile.default_payment = 'UPI'
    profile.low_stock_threshold = 5
    profile.break_even_target = Decimal('25000')
    profile.save()

    # ---- discount rules ----
    DiscountRule.objects.create(min_qty=3, save_amount=Decimal('40'), enabled=True)
    DiscountRule.objects.create(min_qty=5, save_amount=Decimal('50'), enabled=True)

    # ---- categories ----
    categories = {name: Category.objects.create(name=name) for name in CATEGORIES}
    for name in EXPENSE_CATEGORY_DEFS:
        ExpenseCategory.objects.create(name=name)

    # ---- designs + opening batches ----
    rng = mulberry32(987654321)

    def unit_cost_of(batches):
        copies = sum(b.copies for b in batches)
        if not copies:
            return Decimal('0')
        total = sum(Decimal(b.copies) * (b.print_cost + b.sleeve_cost) for b in batches)
        return (total / Decimal(copies))

    designs = {}
    for code, name, cat, price, sold_target, remaining in DESIGN_DEFS:
        planned = sold_target + remaining
        base_print = 14 if price >= 100 else 12 if price >= 80 else 10
        base_sleeve = Decimal('3') if price >= 100 else Decimal('2.5') if price >= 80 else Decimal('2')
        batch_defs = []
        if planned < 22:
            batch_defs.append((code + '-B1', _dt(40 + int(rng() * 20), now=now).date(), planned,
                               Decimal(base_print + 2), base_sleeve + Decimal('0.5'), 'Reprint batch'))
        else:
            first = round(planned * 0.55)
            batch_defs.append((code + '-B1', _dt(88 + int(rng() * 14), now=now).date(), first,
                               Decimal(base_print), base_sleeve, 'First print'))
            batch_defs.append((code + '-B2', _dt(34 + int(rng() * 12), now=now).date(), planned - first,
                               Decimal(base_print + 2), base_sleeve + Decimal('0.5'), 'Reprint — rates increased'))

        rights = 'Licensed reprint' if cat == 'Music' else 'Original artwork — rights cleared'
        design = Design.objects.create(
            code=code, name=name, category=categories[cat], price=Decimal(price),
            quantity=0, avg_cost=Decimal('0'), min_stock=5,
            damaged_quantity=DAMAGED.get(code, 0), notes=NOTES.get(code, ''), rights=rights,
        )
        qty_on_hand = 0
        avg_cost = Decimal('0')
        for b_code, b_date, copies, print_cost, sleeve_cost, note in batch_defs:
            PrintBatch.objects.create(
                code=b_code, design=design, date=b_date, copies=copies,
                print_cost=print_cost, sleeve_cost=sleeve_cost, note=note,
            )
            added_value = Decimal(copies) * (print_cost + sleeve_cost)
            new_qty = qty_on_hand + copies
            avg_cost = (Decimal(qty_on_hand) * avg_cost + added_value) / Decimal(new_qty)
            qty_on_hand = new_qty
        StockMovement.objects.bulk_create([
            StockMovement(design=design, delta=sum(b[2] for b in batch_defs), reason='restock',
                          reference=code, note='Opening batches')
        ])
        damaged = DAMAGED.get(code, 0)
        on_hand_after_damage = qty_on_hand - damaged
        design.quantity = max(on_hand_after_damage, 0)
        design.avg_cost = avg_cost
        design.save(update_fields=['quantity', 'avg_cost'])
        if damaged:
            StockMovement.objects.create(design=design, delta=-damaged, reason='damage',
                                         reference='damage', note='Seed damage log')
        designs[code] = design

    # ---- sales ----
    rng = mulberry32(20261123)
    quotas = {code: int(DESIGN_DEFS[[d[0] for d in DESIGN_DEFS].index(code)][4]) for code in designs}
    sale_rows = []

    def take(code, want):
        have = quotas.get(code, 0)
        n = min(have, want)
        quotas[code] = have - n
        return n

    def push_txn(date_obj):
        active = [code for code, q in quotas.items() if q > 0]
        if not active:
            return None
        roll = rng()
        line_count = 1 if roll < 0.52 else 2 if roll < 0.78 else 3 if roll < 0.9 else 4
        line_count = min(line_count, len(active))
        pool = list(active)
        picks = []
        for _ in range(line_count):
            total_q = sum(quotas[c] for c in pool)
            r = rng() * total_q
            chosen = pool[-1]
            for c in pool:
                r -= quotas[c]
                if r <= 0:
                    chosen = c
                    break
            picks.append(chosen)
            pool.remove(chosen)

        lines = []
        poster_count = 0
        for code in picks:
            q_roll = rng()
            want = 1 if q_roll < 0.72 else 2 if q_roll < 0.92 else 3
            qty = take(code, want)
            if qty <= 0:
                continue
            d = designs[code]
            lines.append({
                'design': d, 'qty': qty, 'unit_price': d.price, 'unit_cost': d.avg_cost,
            })
            poster_count += qty
        if not lines:
            return None

        gross = sum(l['qty'] * l['unit_price'] for l in lines)
        discount = Decimal('50') if poster_count >= 5 else Decimal('40') if poster_count >= 3 else Decimal('0')
        if discount == 0 and rng() < 0.12:
            discount = Decimal('10')
        if rng() > 0.9:
            discount = Decimal('0')
        discount = min(discount, gross)
        net = gross - discount
        pay_roll = rng()
        payment = 'UPI' if pay_roll < 0.52 else 'Cash' if pay_roll < 0.88 else 'Other'

        sale = Sale.objects.create(
            number=f'TMP-{uuid.uuid4().hex[:12]}', date=date_obj, gross=gross, discount=discount, total=net,
            payment=payment, status='completed', created_by=owner,
        )
        for l in lines:
            SaleItem.objects.create(
                sale=sale, design=l['design'], design_code=l['design'].code,
                name=l['design'].name, category=l['design'].category.name,
                qty=l['qty'], unit_price=l['unit_price'], unit_cost=l['unit_cost'],
                line_total=Decimal(l['qty']) * l['unit_price'],
            )
            l['design'].quantity = max(l['design'].quantity - l['qty'], 0)
            l['design'].save(update_fields=['quantity'])
            StockMovement.objects.create(design=l['design'], delta=-l['qty'], reason='sale',
                                         reference='seed', created_by=owner)
        return sale

    now_min = now.hour * 60 + now.minute
    open_min = 8 * 60
    if now_min > open_min + 10:
        span = now_min - open_min
        for f in (0.06, 0.22, 0.37, 0.55, 0.74, 0.94):
            t = round(open_min + span * f + (rng() * 18 - 9))
            if t < open_min or t >= now_min:
                continue
            d = now.replace(hour=t // 60, minute=t % 60, second=0, microsecond=0)
            sale_rows.append(push_txn(d))

    for _ in range(400):
        if not any(q > 0 for q in quotas.values()):
            break
        day_back = math.floor(rng() ** 1.45 * 61) + 1
        d = now - timedelta(days=day_back)
        d = d.replace(hour=10 + int(rng() * 10), minute=int(rng() * 60), second=0, microsecond=0)
        if d.timestamp() > now.timestamp():
            d = now - timedelta(minutes=10)
        sale_rows.append(push_txn(d))

    # number the sales chronologically as S-YYYY-NNNN
    sales = sorted([s for s in sale_rows if s], key=lambda s: s.date)
    per_year = {}
    for s in sales:
        year = s.date.year
        per_year[year] = per_year.get(year, 0) + 1
        s.number = f'S-{year}-{per_year[year]:04d}'
        s.save(update_fields=['number'])

    # ---- expenses ----
    expense_counter = 1000
    for day_back, category, description, amount, mode, kind in EXPENSE_DEFS:
        cat = ExpenseCategory.objects.filter(name__iexact=category).first()
        date = _dt(day_back, hour=11 + (day_back % 7), now=now)
        expense_counter += 1
        Expense.objects.create(
            code=f'E-{expense_counter}', title=description, category=cat,
            amount=Decimal(amount), date=date, mode=mode, kind=kind, created_by=owner,
        )
    DocumentCounter.objects.create(name='expense', seq=expense_counter - 1000)

    # ---- orders ----
    order_counter = 0
    for number, day_back, hour, status, cust, items, method, expected_days, pay_mode, amount, pay_status, note in ORDER_DEFS:
        name, phone, address, area, pin = cust
        order = Order.objects.create(
            number=number, customer_name=name, phone=phone, address=address, area=area,
            city='Surat', pin=pin, method=method, status=status,
            expected_date=(now + timedelta(days=expected_days)).date() if expected_days is not None else None,
            payment_mode=pay_mode, payment_amount=Decimal(amount), payment_status=pay_status,
            note=note, created_by=owner,
        )
        for code, qty in items:
            d = designs[code]
            OrderItem.objects.create(order=order, design=d, design_code=d.code, name=d.name, qty=qty)
        OrderStatusHistory.objects.create(order=order, status=status, by=owner, note='Seeded order')
        order_counter += 1
    DocumentCounter.objects.create(name='order', seq=order_counter)
    for year, count in per_year.items():
        DocumentCounter.objects.create(name=f'sale-{year}', seq=count)

    return {
        'designs': len(designs),
        'sales': len(sales),
        'expenses': len(EXPENSE_DEFS),
        'orders': len(ORDER_DEFS),
        'owner': owner.username,
    }
