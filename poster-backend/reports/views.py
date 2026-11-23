import csv
import io

from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.responses import ok
from . import services


@extend_schema(tags=['Reports'], summary='Daily closing sheet')
class DailyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date = request.query_params.get('date')
        return ok(services.daily_closing(date), 'Daily closing')


@extend_schema(tags=['Reports'], summary='Daily closing sheet as CSV')
class DailyReportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date = request.query_params.get('date')
        sheet = services.daily_closing(date)
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(['Rang Poster Co. — Daily closing', sheet['date']])
        rows = [
            ('Transactions', sheet['transactions']), ('Cancelled', sheet['cancelled']),
            ('Posters sold', sheet['posters_sold']), ('Gross sales (before discounts)', sheet['gross_sales']),
            ('Discounts given', sheet['discounts']), ('Net collected', sheet['net_collected']),
            ('Cost of goods sold', sheet['cogs']), ('Operating expenses', sheet['expenses']),
            ('Gross profit (sales − COGS)', sheet['gross_profit']),
            ('Operating profit (after expenses)', sheet['operating_profit']),
        ]
        for k, v in rows:
            w.writerow([k, v])
        for mode, amount in sheet['payment_breakdown'].items():
            w.writerow([f'Cash in — {mode}', amount])
        response = HttpResponse(buf.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="closing-{sheet["date"]}.csv"'
        return response


@extend_schema(tags=['Reports'], summary='Monthly report')
class MonthlyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        month = request.query_params.get('month') or timezone.now().strftime('%Y-%m')
        report = services.monthly_report(month)
        if request.query_params.get('export') == 'csv':
            buf = io.StringIO()
            w = csv.writer(buf)
            w.writerow(['Date', 'Transactions', 'Net collected', 'Discounts', 'Expenses'])
            for row in report['series']:
                w.writerow([row['date'], row['transactions'], row['net'], row['discounts'], row['expenses']])
            w.writerow(['TOTAL', '', report['net_revenue'], '', report['expenses']])
            response = HttpResponse(buf.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="report-{report["month"]}.csv"'
            return response
        return ok(report, 'Monthly report')


@extend_schema(tags=['Reports'], summary='Custom window roll-up')
class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start = request.query_params.get('from')
        end = request.query_params.get('to')
        first = start or '2000-01-01'
        # reuse daily engine per day would be O(n) — do range-wise aggregation instead
        from datetime import datetime, timedelta
        from decimal import Decimal
        from django.db.models import Sum, Count, F
        from django.utils import timezone
        from sales.models import Sale, SaleItem
        from expenses.models import Expense

        def bound(value, eod):
            dt = datetime.strptime(value, '%Y-%m-%d')
            dt = dt.replace(hour=23, minute=59, second=59) if eod else dt.replace(hour=0, minute=0, second=0)
            return timezone.make_aware(dt, timezone.get_current_timezone())

        s_dt, e_dt = bound(first, False), bound(end or timezone.now().strftime('%Y-%m-%d'), True)
        completed = Sale.objects.filter(status='completed', date__gte=s_dt, date__lte=e_dt)
        items = SaleItem.objects.filter(sale__in=completed)
        revenue = completed.aggregate(t=Sum('total'))['t'] or Decimal('0')
        cogs = items.aggregate(c=Sum(F('qty') * F('unit_cost')))['c'] or Decimal('0')
        posters = items.aggregate(q=Sum('qty'))['q'] or 0
        expenses = Expense.objects.filter(date__gte=s_dt, date__lte=e_dt).aggregate(t=Sum('amount'))['t'] or Decimal('0')
        return ok({
            'from': s_dt.date().isoformat(), 'to': e_dt.date().isoformat(),
            'transactions': completed.count(),
            'posters_sold': posters,
            'revenue': str(revenue),
            'cogs': str(cogs.quantize(Decimal('0.01'))),
            'expenses': str(expenses),
            'net_profit': str((revenue - cogs - expenses).quantize(Decimal('0.01'))),
        }, 'Summary')
