"""JSON backup in the exact shape of the frontend's localStorage snapshot.

    {version: 1, meta, settings, categories[], designs[], sales[], expenses[], orders[], rules[]}

Export and import both use this shape, so a file downloaded from the API restores
cleanly into either a live or a demo frontend, and vice-versa.
"""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.models import Category, DiscountRule, ShopProfile, StockMovement, DocumentCounter
from inventory.models import Design, PrintBatch
from sales.models import Sale, SaleItem
from expenses.models import Expense, ExpenseCategory
from delivery.models import Order, OrderItem, OrderStatusHistory


def dump_state():
    profile = ShopProfile.load()
    categories = list(Category.objects.values_list('name', flat=True))
    designs = []
    for d in Design.objects.prefetch_related('batches').select_related('category'):
        designs.append({
            'id': d.code, 'name': d.name, 'category': d.category.name,
            'price': float(d.price), 'damaged': d.damaged_quantity, 'notes': d.notes,
            'rights': d.rights, 'archived': d.archived,
            'batches': [{
                'id': b.code, 'date': b.date.isoformat(), 'copies': b.copies,
                'printCost': float(b.print_cost), 'sleeveCost': float(b.sleeve_cost), 'note': b.note,
            } for b in d.batches.all()],
            'createdAt': d.created_at.isoformat(),
        })
    sales = []
    for s in Sale.objects.prefetch_related('items').order_by('date'):
        sales.append({
            'id': s.number, 'date': s.date.isoformat(),
            'lines': [{'designId': i.design_code, 'name': i.name, 'category': i.category,
                       'qty': i.qty, 'unitPrice': float(i.unit_price), 'unitCost': float(i.unit_cost)}
                      for i in s.items.all()],
            'gross': float(s.gross), 'discount': float(s.discount), 'net': float(s.total),
            'payment': s.payment, 'note': s.note, 'status': s.status,
            'cancelReason': s.cancel_reason or None, 'createdAt': s.created_at.isoformat(),
        })
    expenses = []
    for e in Expense.objects.select_related('category').order_by('date'):
        expenses.append({
            'id': e.code, 'date': e.date.isoformat(), 'category': e.category.name,
            'description': e.title, 'amount': float(e.amount), 'mode': e.mode,
            'kind': e.kind, 'note': e.note, 'createdAt': e.created_at.isoformat(),
        })
    METHOD_MAP_INV = {'home-delivery': 'Home Delivery', 'pickup': 'Customer Pickup'}
    orders = []
    for o in Order.objects.prefetch_related('items', 'history').order_by('created_at'):
        orders.append({
            'id': o.number, 'date': o.created_at.isoformat(), 'status': o.status,
            'customer': {'name': o.customer_name, 'phone': o.phone, 'address': o.address,
                         'area': o.area, 'city': o.city, 'pin': o.pin},
            'items': [{'designId': i.design_code, 'qty': i.qty} for i in o.items.all()],
            'method': METHOD_MAP_INV.get(o.method, o.method),
            'expectedDate': o.expected_date.isoformat() if o.expected_date else None,
            'payment': {'mode': o.payment_mode, 'amount': float(o.payment_amount), 'status': o.payment_status},
            'note': o.note,
            'history': [{'at': h.at.isoformat(), 'status': h.status} for h in o.history.all()],
        })
    rules = [{'id': f'rule-{r.min_qty}', 'qty': r.min_qty, 'save': float(r.save_amount), 'enabled': r.enabled}
             for r in DiscountRule.objects.order_by('min_qty')]
    return {
        'version': 1,
        'meta': {'seededAt': timezone.now().isoformat(), 'business': profile.business_name,
                 'source': 'rang-poster-api'},
        'settings': {
            'businessName': profile.business_name, 'ownerName': profile.owner_name,
            'ownerRole': profile.owner_role, 'phone': profile.phone, 'address': profile.address,
            'defaultPrice': float(profile.default_price), 'lowStockThreshold': profile.low_stock_threshold,
            'breakEvenTarget': float(profile.break_even_target), 'currency': profile.currency,
            'defaultPayment': profile.default_payment,
        },
        'categories': categories, 'designs': designs, 'sales': sales,
        'expenses': expenses, 'orders': orders, 'rules': rules,
    }


@transaction.atomic
def restore_state(payload):
    if not isinstance(payload, dict) or payload.get('version') != 1:
        raise ValueError('Not a valid Rang Poster Co. backup (version must be 1).')
    required = ('designs', 'sales', 'expenses', 'orders', 'settings', 'rules')
    missing = [k for k in required if k not in payload]
    if missing:
        raise ValueError(f'Backup is missing sections: {", ".join(missing)}')

    from core.demo_seed import clear_business_data
    clear_business_data()
    ShopProfile.objects.all().delete()

    owner_name = 'Aarav Mehta'
    st = payload.get('settings') or {}
    ShopProfile.objects.create(
        pk=1,
        business_name=st.get('businessName', 'Rang Poster Co.'),
        owner_name=st.get('ownerName', owner_name),
        owner_role=st.get('ownerRole', 'Owner'),
        phone=st.get('phone', ''), address=st.get('address', ''),
        currency=st.get('currency', 'INR'),
        default_price=Decimal(str(st.get('defaultPrice', 60))),
        default_payment=st.get('defaultPayment', 'UPI'),
        low_stock_threshold=int(st.get('lowStockThreshold', 5)),
        break_even_target=Decimal(str(st.get('breakEvenTarget', 25000))),
    )

    category_map = {}
    for name in payload.get('categories') or []:
        category_map[name] = Category.objects.create(name=name)

    for rule in payload.get('rules') or []:
        DiscountRule.objects.create(
            min_qty=int(rule.get('qty', 0)), save_amount=Decimal(str(rule.get('save', 0))),
            enabled=bool(rule.get('enabled', True)),
        )

    def cat_for(name):
        if name not in category_map:
            category_map[name] = Category.objects.create(name=name)
        return category_map[name]

    design_map = {}
    for d in payload['designs']:
        batches = d.get('batches') or []
        qty = 0
        avg_cost = Decimal('0')
        for b in batches:
            copies = int(b.get('copies', 0))
            pc = Decimal(str(b.get('printCost', 0)))
            sc = Decimal(str(b.get('sleeveCost', 0)))
            new_qty = qty + copies
            avg_cost = (Decimal(qty) * avg_cost + Decimal(copies) * (pc + sc)) / Decimal(new_qty) if new_qty else Decimal('0')
            qty = new_qty
        design = Design.objects.create(
            code=d['id'], name=d.get('name', d['id']), category=cat_for(d.get('category', 'Miscellaneous')),
            price=Decimal(str(d.get('price', 0))), quantity=qty, avg_cost=avg_cost,
            min_stock=int(d.get('minStock', 5)) if isinstance(d.get('minStock'), int) else 5,
            damaged_quantity=int(d.get('damaged', 0)),
            notes=d.get('notes', ''), rights=d.get('rights', ''), archived=bool(d.get('archived', False)),
        )
        for b in batches:
            PrintBatch.objects.create(
                code=b['id'], design=design, date=b['date'][:10], copies=int(b['copies']),
                print_cost=Decimal(str(b.get('printCost', 0))), sleeve_cost=Decimal(str(b.get('sleeveCost', 0))),
                note=b.get('note', ''),
            )
        design_map[design.code] = design

    # subtract damaged units once (stock on hand = printed − damaged − sold later)
    for d in Design.objects.filter(damaged_quantity__gt=0):
        d.quantity = max(d.quantity - d.damaged_quantity, 0)
        d.save(update_fields=['quantity'])

    sale_counter = {}
    for s in sorted(payload.get('sales') or [], key=lambda s: s.get('date', '')):
        lines = s.get('lines') or []
        if not lines:
            continue
        date = timezone.datetime.fromisoformat(s['date'].replace('Z', '+00:00'))
        gross = Decimal(str(s.get('gross', 0)))
        total = Decimal(str(s.get('net', gross)))
        discount = Decimal(str(s.get('discount', 0)))
        sale = Sale.objects.create(
            number=s.get('id') or 'PENDING', date=date, gross=gross, discount=discount, total=total,
            payment=s.get('payment', 'UPI'), status=s.get('status', 'completed'),
            cancel_reason=s.get('cancelReason') or '', note=s.get('note', ''),
        )
        for l in lines:
            design = design_map.get(l.get('designId'))
            if design is None:
                continue
            qty = int(l.get('qty', 1))
            SaleItem.objects.create(
                sale=sale, design=design, design_code=design.code, name=l.get('name', design.name),
                category=l.get('category', design.category.name), qty=qty,
                unit_price=Decimal(str(l.get('unitPrice', design.price))),
                unit_cost=Decimal(str(l.get('unitCost', design.avg_cost))),
                line_total=Decimal(qty) * Decimal(str(l.get('unitPrice', design.price))),
            )
            if sale.status == 'completed':
                design.quantity = max(design.quantity - qty, 0)
        sale.save()
        year = date.year
        sale_counter[year] = sale_counter.get(year, 0) + 1
    for d in design_map.values():
        d.save(update_fields=['quantity'])

    METHOD_MAP = {'Home Delivery': 'home-delivery', 'Customer Pickup': 'pickup'}
    order_counter = 0
    for o in payload.get('orders') or []:
        cust = o.get('customer') or {}
        raw_date = o.get('date') or timezone.now().isoformat()
        date = timezone.datetime.fromisoformat(raw_date.replace('Z', '+00:00'))
        payment = o.get('payment') or {}
        expected = o.get('expectedDate')
        order = Order.objects.create(
            number=o.get('id') or f'HD-{order_counter + 1:04d}',
            customer_name=cust.get('name', 'Customer'), phone=cust.get('phone', ''),
            address=cust.get('address', ''), area=cust.get('area', ''),
            city=cust.get('city', 'Surat'), pin=cust.get('pin', ''),
            method=METHOD_MAP.get(o.get('method', 'Home Delivery'), 'home-delivery'),
            status=o.get('status', 'request-received'),
            expected_date=timezone.datetime.fromisoformat(expected).date() if expected else None,
            payment_mode=payment.get('mode', 'UPI'),
            payment_amount=Decimal(str(payment.get('amount', 0))),
            payment_status=payment.get('status', 'unpaid'),
            note=o.get('note', ''),
        )
        for i in o.get('items') or []:
            design = design_map.get(i.get('designId'))
            if design is None:
                continue
            OrderItem.objects.create(order=order, design=design, design_code=design.code,
                                     name=design.name, qty=int(i.get('qty', 1)))
        for h in o.get('history') or []:
            at = h.get('at')
            OrderStatusHistory.objects.create(order=order, status=h.get('status', order.status))
        order_counter += 1

    for year, count in sale_counter.items():
        DocumentCounter.objects.create(name=f'sale-{year}', seq=count)
    DocumentCounter.objects.create(name='order', seq=order_counter)
    DocumentCounter.objects.create(name='expense', seq=sum(1 for _ in payload.get('expenses') or []))
    for idx, e in enumerate(payload.get('expenses') or [], start=1):
        cat_name = e.get('category', 'Miscellaneous')
        cat = ExpenseCategory.objects.filter(name__iexact=cat_name).first() or ExpenseCategory.objects.create(name=cat_name)
        code = e.get('id') or f'E-{1000 + idx}'
        date = timezone.datetime.fromisoformat(e['date'].replace('Z', '+00:00'))
        Expense.objects.create(
            code=code, title=e.get('description') or e.get('title') or 'Expense',
            category=cat, amount=Decimal(str(e.get('amount', 0))), date=date,
            mode=e.get('mode', 'Cash'), kind=e.get('kind', 'one-time'), note=e.get('note', ''),
        )
    return {'designs': len(design_map), 'sales': len(sale_counter) and sum(sale_counter.values()),
            'expenses': len(payload.get('expenses') or []), 'orders': order_counter}
