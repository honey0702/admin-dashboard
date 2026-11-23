from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from datetime import datetime
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response

from core.responses import ok, created
from .models import Expense, ExpenseCategory
from .serializers import ExpenseCategorySerializer, ExpenseSerializer


def _parse_bound(value, end_of_day=False):
    dt = datetime.strptime(value, '%Y-%m-%d')
    dt = dt.replace(hour=23, minute=59, second=59) if end_of_day else dt.replace(hour=0, minute=0, second=0)
    return timezone.make_aware(dt, timezone.get_current_timezone())


@extend_schema(tags=['Expenses'])
class ExpenseViewSet(ModelViewSet):
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head']

    def get_queryset(self):
        qs = Expense.objects.select_related('category')
        params = self.request.query_params
        if params.get('from'):
            qs = qs.filter(date__gte=_parse_bound(params['from'], False))
        if params.get('to'):
            qs = qs.filter(date__lte=_parse_bound(params['to'], True))
        category = params.get('category')
        if category and category.lower() != 'all':
            qs = qs.filter(category__name__iexact=category)
        mode = params.get('mode')
        if mode and mode.lower() != 'all':
            qs = qs.filter(mode__iexact=mode)
        kind = params.get('kind')
        if kind and kind.lower() != 'all':
            qs = qs.filter(kind=kind.lower())
        search = params.get('search') or params.get('q')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search) |
                           Q(category__name__icontains=search) | Q(note__icontains=search) | Q(code__icontains=search))
        return qs

    def list(self, request, *args, **kwargs):
        return ok(ExpenseSerializer(self.get_queryset(), many=True, context={'request': request}).data, 'Expenses')

    def retrieve(self, request, *args, **kwargs):
        return ok(ExpenseSerializer(self.get_object(), context={'request': request}).data, 'Expense')

    def create(self, request, *args, **kwargs):
        serializer = ExpenseSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        expense = serializer.save(created_by=request.user)
        return created(ExpenseSerializer(expense, context={'request': request}).data, 'Expense added')

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ExpenseSerializer(instance, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        expense = serializer.save()
        return ok(ExpenseSerializer(expense, context={'request': request}).data, 'Expense updated')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        code = instance.code
        instance.delete()
        return ok({'id': code}, 'Expense deleted')

    def get_object(self):
        from rest_framework.exceptions import NotFound
        try:
            return Expense.objects.select_related('category').get(code=self.kwargs['pk'])
        except Expense.DoesNotExist:
            raise NotFound('Expense not found')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        total = qs.aggregate(t=Sum('amount'))['t'] or Decimal('0')
        one_time = qs.filter(kind='one-time').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        recurring = qs.filter(kind='recurring').aggregate(t=Sum('amount'))['t'] or Decimal('0')
        by_category = (qs.values('category__name')
                       .annotate(total=Sum('amount'))
                       .order_by('-total'))
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month = qs.filter(date__gte=month_start).aggregate(t=Sum('amount'))['t'] or Decimal('0')
        return ok({
            'total': str(total), 'one_time': str(one_time), 'recurring': str(recurring),
            'this_month': str(month), 'records': qs.count(),
            'by_category': [{'category': r['category__name'], 'total': str(r['total'])} for r in by_category],
        }, 'Expense statistics')


@extend_schema(tags=['Expenses'])
class ExpenseCategoryViewSet(ModelViewSet):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    queryset = ExpenseCategory.objects.all()

    def list(self, request, *args, **kwargs):
        return ok(ExpenseCategorySerializer(self.get_queryset(), many=True).data, 'Expense categories')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return created(serializer.data, 'Category created')

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(serializer.data, 'Category updated')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.expenses.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'category': 'This category has expenses and cannot be deleted. Disable it instead.'})
        instance.delete()
        return ok(None, 'Category deleted')
