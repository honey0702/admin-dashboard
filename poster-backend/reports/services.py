"""Daily / monthly closing sheets from live sales + expenses."""
from datetime import datetime
from decimal import Decimal

from django.db.models import F, Sum
from django.conf import settings
from zoneinfo import ZoneInfo
from django.utils import timezone

from sales.models import Sale, SaleItem
from expenses.models import Expense


def _day_bounds(date_str=None):
    date = datetime.strptime(date_str, '%Y-%m-%d').date() if date_str else timezone.localdate()
    start = timezone.make_aware(datetime.combine(date, datetime.min.time()), timezone.get_current_timezone())
    end = timezone.make_aware(datetime.combine(date, datetime.max.time()), timezone.get_current_timezone())
    return date, start, end


def daily_closing(date_str=None):
    date, start, end = _day_bounds(date_str)
    sales = Sale.objects.filter(date__gte=start, date__lte=end)
    completed = sales.filter(status='completed')
    items = SaleItem.objects.filter(sale__in=completed)

    agg = completed.aggregate(gross=Sum('gross'), discounts=Sum('discount'), net=Sum('total'))
    posters = items.aggregate(q=Sum('qty'))['q'] or 0
    cogs = items.aggregate(c=Sum(F('qty') * F('unit_cost')))['c'] or Decimal('0')
    expenses = Expense.objects.filter(date__gte=start, date__lte=end).aggregate(t=Sum('amount'))['t'] or Decimal('0')

    gross = agg['gross'] or Decimal('0')
    discounts = agg['discounts'] or Decimal('0')
    net = agg['net'] or Decimal('0')
    gross_profit = gross - cogs
    operating_profit = net - cogs - expenses

    payment_rows = completed.values('payment').annotate(total=Sum('total'))
    payment_breakdown = {r['payment']: str(r['total']) for r in payment_rows}
    method_expense = expenses  # operating overhead is not tied to a method; report net cash instead

    return {
        'date': date.isoformat(),
        'weekday': date.strftime('%A, %d %B %Y'),
        'transactions': completed.count(),
        'cancelled': sales.filter(status='cancelled').count(),
        'posters_sold': posters,
        'gross_sales': str(gross),
        'discounts': str(discounts),
        'net_collected': str(net),
        'expenses': str(expenses),
        'cogs': str(cogs.quantize(Decimal('0.01'))),
        'gross_profit': str(gross_profit.quantize(Decimal('0.01'))),
        'operating_profit': str(operating_profit.quantize(Decimal('0.01'))),
        'payment_breakdown': {m: str(payment_breakdown.get(m, '0')) for m in ('Cash', 'UPI', 'Card', 'Bank', 'Other')},
        'net_cash_movement': str(net),
    }


def monthly_report(month_str):
    month = datetime.strptime(month_str, '%Y-%m')
    start = timezone.make_aware(datetime(month.year, month.month, 1), timezone.get_current_timezone())
    end = (timezone.make_aware(datetime(month.year + (month.month == 12), (month.month % 12) + 1, 1),
                               timezone.get_current_timezone()))
    tz = ZoneInfo(settings.TIME_ZONE)

    def local_day(value):
        return value.astimezone(tz).date() if timezone.is_aware(value) else value.date()

    day_map = {}
    for date_val, total, gross, discount in Sale.objects.filter(
            status='completed', date__gte=start, date__lt=end).values_list('date', 'total', 'gross', 'discount'):
        key = str(local_day(date_val))
        agg = day_map.setdefault(key, {'net': Decimal('0'), 'gross': Decimal('0'),
                                       'discounts': Decimal('0'), 'transactions': 0})
        agg['net'] += total
        agg['gross'] += gross
        agg['discounts'] += discount
        agg['transactions'] += 1

    expense_by_day = {}
    for date_val, amount in Expense.objects.filter(date__gte=start, date__lt=end).values_list('date', 'amount'):
        key = str(local_day(date_val))
        expense_by_day[key] = expense_by_day.get(key, Decimal('0')) + amount

    series = [{
        'date': key,
        'transactions': v['transactions'],
        'net': str(v['net']),
        'discounts': str(v['discounts']),
        'expenses': str(expense_by_day.get(key, Decimal('0'))),
    } for key, v in sorted(day_map.items())]
    totals_net = sum((v['net'] for v in day_map.values()), Decimal('0'))
    totals_exp = sum(expense_by_day.values(), Decimal('0'))
    return {
        'month': month.strftime('%Y-%m'),
        'label': month.strftime('%B %Y'),
        'days': len(series),
        'series': series,
        'net_revenue': str(totals_net),
        'expenses': str(totals_exp),
        'operating_result': str(totals_net - totals_exp),
    }
