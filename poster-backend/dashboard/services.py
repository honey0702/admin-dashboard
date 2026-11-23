"""Dashboard aggregation — computed live from the database, never hardcoded."""
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Count, F, Sum
from django.conf import settings
from django.utils import timezone
from zoneinfo import ZoneInfo

from sales.models import Sale, SaleItem
from expenses.models import Expense
from inventory.models import Design


def parse_range(params):
    now = timezone.now()
    today = now.date()
    range_key = (params.get('range') or '30d').lower()
    custom_from, custom_to = params.get('from'), params.get('to')
    if custom_from and custom_to:
        start = datetime.strptime(custom_from, '%Y-%m-%d').date()
        end = datetime.strptime(custom_to, '%Y-%m-%d').date()
    elif range_key == 'all':
        first_sale = Sale.objects.order_by('date').first()
        start = first_sale.date.date() if first_sale else today - timedelta(days=365)
        end = today
    else:
        days = {'7d': 7, '14d': 14, '30d': 30, '90d': 90}.get(range_key, 30)
        end = today
        start = today - timedelta(days=days - 1)
    start_dt = timezone.make_aware(datetime.combine(start, datetime.min.time()), timezone.get_current_timezone())
    end_dt = timezone.make_aware(datetime.combine(end, datetime.max.time()), timezone.get_current_timezone())
    return start, end, start_dt, end_dt


def _sale_cogs(qs):
    total = SaleItem.objects.filter(sale__in=qs).aggregate(
        c=Sum(F('qty') * F('unit_cost')))['c']
    return total or Decimal('0')


def overview(params):
    start, end, start_dt, end_dt = parse_range(params)
    sales = Sale.objects.filter(date__gte=start_dt, date__lte=end_dt)
    completed = sales.filter(status='completed')
    cancelled = sales.filter(status='cancelled').count()

    agg = completed.aggregate(
        transactions=Count('id'), gross=Sum('gross'), discounts=Sum('discount'), total=Sum('total'),
    )
    revenue = agg['total'] or Decimal('0')
    gross = agg['gross'] or Decimal('0')
    discounts = agg['discounts'] or Decimal('0')

    items = SaleItem.objects.filter(sale__in=completed)
    posters = items.aggregate(q=Sum('qty'))['q'] or 0
    cogs = items.aggregate(c=Sum(F('qty') * F('unit_cost')))['c'] or Decimal('0')

    expenses = Expense.objects.filter(date__gte=start_dt, date__lte=end_dt)
    expense_total = expenses.aggregate(t=Sum('amount'))['t'] or Decimal('0')

    gross_profit = revenue - cogs
    net_profit = gross_profit - expense_total
    days = (end - start).days + 1

    # stock position (current, not range-bound)
    stock = Design.objects.filter(archived=False)
    available_stock = stock.aggregate(q=Sum('quantity'))['q'] or 0
    stock_value = sum((d.quantity * d.avg_cost for d in stock), Decimal('0'))
    low_stock = stock.filter(quantity__gt=0, quantity__lte=F('min_stock')).count()
    out_of_stock = stock.filter(quantity=0).count()

    # daily series for chart — grouped in Python (no reliance on DB time-zone tables)
    tz = ZoneInfo(settings.TIME_ZONE)

    def local_day(value):
        return value.astimezone(tz).date() if timezone.is_aware(value) else value.date()

    sale_by_day = {}
    for date_val, total in completed.values_list('date', 'total'):
        key = str(local_day(date_val))
        agg = sale_by_day.setdefault(key, {'revenue': Decimal('0'), 'transactions': 0})
        agg['revenue'] += total
        agg['transactions'] += 1

    exp_by_day = {}
    for date_val, amount in expenses.values_list('date', 'amount'):
        key = str(local_day(date_val))
        exp_by_day[key] = exp_by_day.get(key, Decimal('0')) + amount

    series = []
    for i in range(days):
        day = start + timedelta(days=i)
        key = day.isoformat()
        row = sale_by_day.get(key)
        series.append({
            'date': key,
            'revenue': str(row['revenue'] if row else Decimal('0')),
            'transactions': row['transactions'] if row else 0,
            'expenses': str(exp_by_day.get(key, Decimal('0'))),
        })

    best = (items.values('design_code', 'name', 'category')
            .annotate(units=Sum('qty'), revenue=Sum('line_total'))
            .order_by('-units')[:6])
    category_rows = (items.values('category').annotate(revenue=Sum('line_total')).order_by('-revenue'))
    payment_rows = (completed.values('payment').annotate(total=Sum('total'), count=Count('id')).order_by('-total'))

    monthly_map = {}
    for date_val, total in Sale.objects.filter(status='completed').values_list('date', 'total'):
        key = local_day(date_val).strftime('%Y-%m')
        agg = monthly_map.setdefault(key, {'revenue': Decimal('0'), 'transactions': 0})
        agg['revenue'] += total
        agg['transactions'] += 1
    monthly = sorted(
        ({'month': k, 'revenue': str(v['revenue']), 'transactions': v['transactions']}
         for k, v in monthly_map.items()),
        key=lambda r: r['month'], reverse=True)[:12]

    # month-to-date position vs break-even target
    from core.models import ShopProfile
    profile = ShopProfile.load()
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    mtd = Sale.objects.filter(status='completed', date__gte=month_start).aggregate(t=Sum('total'))['t'] or Decimal('0')
    target = profile.break_even_target or Decimal('1')
    pct = min(int(Decimal(mtd) / target * 100), 100) if target else 0

    return {
        'range': {'from': start.isoformat(), 'to': end.isoformat(), 'days': days, 'key': params.get('range', '30d')},
        'revenue': str(revenue),
        'gross_sales': str(gross),
        'discounts': str(discounts),
        'expenses': str(expense_total),
        'cogs': str(cogs.quantize(Decimal('0.01'))),
        'gross_profit': str(gross_profit.quantize(Decimal('0.01'))),
        'net_profit': str(net_profit.quantize(Decimal('0.01'))),
        'transactions': agg['transactions'] or 0,
        'cancelled': cancelled,
        'posters_sold': posters,
        'avg_order_value': str((revenue / agg['transactions']).quantize(Decimal('0.01'))) if agg['transactions'] else '0.00',
        'avg_per_day': str((revenue / days).quantize(Decimal('0.01'))) if days else '0.00',
        'available_stock': available_stock,
        'stock_value': str(stock_value.quantize(Decimal('0.01'))),
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'recent_sales': _recent_sales(),
        'series': series,
        'best_sellers': [{'design_code': r['design_code'], 'name': r['name'], 'category': r['category'],
                          'units': r['units'], 'revenue': str(r['revenue'])} for r in best],
        'category_revenue': [{'category': r['category'], 'revenue': str(r['revenue'])} for r in category_rows],
        'payment_mix': [{'payment': r['payment'], 'total': str(r['total']), 'count': r['count']} for r in payment_rows],
        'monthly_revenue': [{'month': r['month'], 'revenue': str(r['revenue']), 'transactions': r['transactions']} for r in monthly],
        'break_even': {'target': str(profile.break_even_target), 'month_to_date': str(mtd), 'pct': pct},
    }


def _recent_sales(limit=4):
    from sales.serializers import SaleSerializer
    qs = Sale.objects.filter(status='completed').prefetch_related('items').order_by('-date')[:limit]
    return SaleSerializer(qs, many=True).data
