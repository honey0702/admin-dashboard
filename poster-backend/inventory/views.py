from decimal import Decimal

from django.db.models import Count, F, Q, Sum
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from django.http import HttpResponse
from django.db import transaction
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet
from rest_framework.views import APIView
from rest_framework.decorators import api_view

from core.models import ShopProfile, StockMovement
from core.responses import ok, created
from .models import Design, PrintBatch
from . import services
from .serializers import (
    BatchCreateSerializer, DamageSerializer, DesignSerializer, DesignWriteSerializer,
    PrintBatchSerializer, StockMovementSerializer,
)


@extend_schema(tags=['Inventory'])
class DesignViewSet(ModelViewSet):
    """Designs (products). Search by code/name/category; filter by category/stock/archived."""
    permission_classes = [IsAuthenticated]
    pagination_class = None  # catalogue is small (<100); return plain list in data envelope

    def get_queryset(self):
        qs = Design.objects.select_related('category').prefetch_related('batches')
        params = self.request.query_params
        search = params.get('search') or params.get('q')
        if search:
            qs = qs.filter(Q(code__icontains=search) | Q(name__icontains=search) | Q(category__name__icontains=search))
        category = params.get('category')
        if category and category.lower() != 'all':
            qs = qs.filter(category__name__iexact=category)
        if params.get('archived') is not None:
            qs = qs.filter(archived=params.get('archived', '').lower() in ('1', 'true', 'yes'))
        elif not params.get('include_archived'):
            qs = qs.exclude(archived=True)
        if params.get('out_of_stock', '').lower() in ('1', 'true', 'yes'):
            qs = qs.filter(quantity=0)
        if params.get('low_stock', '').lower() in ('1', 'true', 'yes'):
            qs = qs.filter(quantity__gt=0, quantity__lte=F('min_stock'))
        ordering = params.get('ordering')
        if ordering and ordering.lstrip('-') in ('code', 'name', 'price', 'quantity', 'created_at'):
            qs = qs.order_by(ordering)
        return qs

    def get_object(self):
        from rest_framework.exceptions import NotFound
        try:
            return Design.objects.select_related('category').prefetch_related('batches').get(code=self.kwargs['pk'])
        except Design.DoesNotExist:
            raise NotFound('Design not found')

    def get_serializer_class(self):
        return DesignWriteSerializer if self.action in ('create', 'partial_update', 'update') else DesignSerializer

    def list(self, request, *args, **kwargs):
        designs = self.get_queryset()
        return ok(DesignSerializer(designs, many=True, context={'request': request}).data, 'Designs')

    def retrieve(self, request, *args, **kwargs):
        return ok(DesignSerializer(self.get_object(), context={'request': request}).data, 'Design')

    def create(self, request, *args, **kwargs):
        serializer = DesignWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        design = serializer.save()
        return created(DesignSerializer(design, context={'request': request}).data, 'Design created')

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        data = request.data.copy()
        # never allow direct stock edits here — use batches / damage / adjustment
        for forbidden in ('quantity', 'avg_cost', 'damaged_quantity', 'code'):
            data.pop(forbidden, None)
        serializer = DesignWriteSerializer(instance, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        design = serializer.save()
        return ok(DesignSerializer(design, context={'request': request}).data, 'Design updated')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.archived = True  # delete = archive; history must survive
        instance.save(update_fields=['archived', 'updated_at'])
        return ok({'id': instance.code}, 'Design archived')

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        design = self.get_object()
        design.archived = not design.archived  # toggle: archive ↔ restore
        design.save(update_fields=['archived', 'updated_at'])
        return ok(DesignSerializer(design, context={'request': request}).data,
                  'Design archived' if design.archived else 'Design restored')

    @action(detail=True, methods=['post'])
    def batches(self, request, pk=None):
        design = self.get_object()
        serializer = BatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        count = design.batches.count() + 1
        batch = PrintBatch.objects.create(
            code=f'{design.code}-B{count}', design=design,
            date=d.get('date') or timezone.now().date(), copies=d['copies'],
            print_cost=d['print_cost'], sleeve_cost=d['sleeve_cost'], note=d.get('note', ''),
        )
        services.apply_batch(batch)
        design.refresh_from_db()
        return created({'batch': PrintBatchSerializer(batch).data,
                        'design': DesignSerializer(design, context={'request': request}).data},
                       'Batch recorded')

    @action(detail=True, methods=['post'])
    def damage(self, request, pk=None):
        design = self.get_object()
        serializer = DamageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        qty = serializer.validated_data['quantity']
        note = serializer.validated_data.get('note', '')
        if qty > design.quantity:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'quantity': f'Only {design.quantity} copies on hand.'})
        with transaction.atomic():
            services.adjust_stock(design.id, -qty, 'damage', reference='damage', note=note, user=request.user)
            design.refresh_from_db()
            design.damaged_quantity = F('damaged_quantity') + qty
            design.save(update_fields=['damaged_quantity'])
        design.refresh_from_db()
        return ok(DesignSerializer(design, context={'request': request}).data, 'Damage logged')

    @action(detail=True, methods=['get'])
    def movements(self, request, pk=None):
        design = self.get_object()
        rows = StockMovement.objects.filter(design=design).order_by('-created_at')[:100]
        return ok(StockMovementSerializer(rows, many=True).data, 'Stock movements')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = Design.objects.filter(archived=False)
        total_copies = qs.aggregate(t=Sum('quantity'))['t'] or 0
        value = sum((d.quantity * d.avg_cost for d in qs), Decimal('0'))
        low = qs.filter(quantity__gt=0, quantity__lte=F('min_stock')).count()
        out = qs.filter(quantity=0).count()
        return ok({
            'designs': qs.count(),
            'total_copies': total_copies,
            'stock_value': str(value.quantize(Decimal('0.01'))),
            'low_stock': low,
            'out_of_stock': out,
        }, 'Inventory statistics')


@extend_schema(tags=['Inventory'], summary='Low-stock designs')
class LowStockView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Design.objects.filter(archived=False, quantity__gt=0, quantity__lte=F('min_stock')).order_by('quantity')
        return ok(DesignSerializer(qs, many=True, context={'request': request}).data, 'Low stock')


@extend_schema(tags=['Inventory'], summary='Out-of-stock designs')
class OutOfStockView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Design.objects.filter(archived=False, quantity=0)
        return ok(DesignSerializer(qs, many=True, context={'request': request}).data, 'Out of stock')
