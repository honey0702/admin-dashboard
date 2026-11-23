"""Shared query-param filtering for sales (used by views and dashboard)."""
from datetime import datetime, time

from django.utils import timezone


def _parse_date(value, end_of_day=False):
    dt = datetime.strptime(value, '%Y-%m-%d')
    dt = dt.replace(hour=23, minute=59, second=59) if end_of_day else dt.replace(hour=0, minute=0, second=0)
    return timezone.make_aware(dt, timezone.get_current_timezone())


def apply_sales_filters(qs, params):
    date_from = params.get('from') or params.get('from_date')
    date_to = params.get('to') or params.get('to_date')
    if date_from:
        qs = qs.filter(date__gte=_parse_date(date_from, False))
    if date_to:
        qs = qs.filter(date__lte=_parse_date(date_to, True))
    payment = params.get('payment')
    if payment and payment.lower() != 'all':
        qs = qs.filter(payment__iexact=payment)
    status = params.get('status')
    if status and status.lower() != 'all':
        qs = qs.filter(status=status.lower())
    search = params.get('search') or params.get('q')
    if search:
        qs = qs.filter(number__icontains=search) | qs.filter(items__design_code__icontains=search)
        qs = qs.distinct()
    return qs
