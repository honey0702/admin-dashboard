from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from core.responses import ok, created
from .models import Sale
from . import services, filters
from .serializers import (
    CancelSaleSerializer, SaleCreateSerializer, SaleSerializer,
)


@extend_schema(tags=['Sales'])
class SaleViewSet(ModelViewSet):
    """List/create/retrieve sales. Creating validates stock and deducts it atomically."""
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'head']

    def get_queryset(self):
        qs = Sale.objects.prefetch_related('items')
        params = self.request.query_params
        qs = filters.apply_sales_filters(qs, params)
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        limit = int(request.query_params.get('limit', 0) or 0)
        if limit:
            qs = qs[:limit]
        return ok(SaleSerializer(qs, many=True).data, 'Sales')

    def retrieve(self, request, *args, **kwargs):
        return ok(SaleSerializer(self.get_object()).data, 'Sale')

    def get_object(self):
        # lookups by sale number (S-2026-0001), matching the frontend route ids
        number = self.kwargs['pk']
        try:
            return Sale.objects.prefetch_related('items').get(number=number)
        except Sale.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Sale not found')

    def create(self, request, *args, **kwargs):
        serializer = SaleCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        try:
            sale = services.create_sale(
                lines=d['lines'], payment=d['payment'], note=d.get('note', ''),
                discount=d.get('discount'), created_by=request.user, date=d.get('date'),
            )
        except services.SaleValidationError as exc:
            raise ValidationError({exc.field or 'sale': exc.message})
        return created(SaleSerializer(sale).data, 'Sale recorded')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        sale = self.get_object()
        serializer = CancelSaleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = services.cancel_sale(sale, reason=serializer.validated_data['reason'], created_by=request.user)
        return ok(SaleSerializer(sale).data, 'Sale cancelled — stock restored')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = filters.apply_sales_filters(Sale.objects.all(), request.query_params)
        completed = qs.filter(status='completed')
        agg = completed.aggregate(count=Count('id'), revenue=Sum('total'), discount=Sum('discount'),
                                  gross=Sum('gross'), avg_order=Avg('total'))
        posters = sum(i.qty for s in completed.prefetch_related('items') for i in s.items.all())
        return ok({
            'transactions': agg['count'] or 0,
            'revenue': str(agg['revenue'] or Decimal('0')),
            'gross': str(agg['gross'] or Decimal('0')),
            'discounts': str(agg['discount'] or Decimal('0')),
            'avg_order_value': str((agg['avg_order'] or Decimal('0')).quantize(Decimal('0.01')) if agg['avg_order'] else '0.00'),
            'posters_sold': posters,
            'cancelled': qs.filter(status='cancelled').count(),
        }, 'Sales statistics')


@extend_schema(tags=['Sales'], summary='Sales net total (lightweight)')
class SalesSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = filters.apply_sales_filters(Sale.objects.all(), request.query_params).filter(status='completed')
        total = qs.aggregate(t=Sum('total'))['t'] or Decimal('0')
        return ok({'revenue': str(total), 'count': qs.count()}, 'Summary')
