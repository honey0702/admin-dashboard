from datetime import datetime

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView

from core.responses import ok, created
from . import services
from .models import Order, STATUSES
from .serializers import (
    OrderCreateSerializer, OrderPatchSerializer, OrderSerializer,
    OrderStatusHistorySerializer, OrderStatusSerializer,
)


def _parse_bound(value, end_of_day=False):
    dt = datetime.strptime(value, '%Y-%m-%d')
    dt = dt.replace(hour=23, minute=59, second=59) if end_of_day else dt.replace(hour=0, minute=0, second=0)
    return timezone.make_aware(dt, timezone.get_current_timezone())


@extend_schema(tags=['Delivery'])
class OrderViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = OrderSerializer
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'head']

    def get_queryset(self):
        qs = Order.objects.prefetch_related('items', 'history').select_related('linked_sale')
        params = self.request.query_params
        status = params.get('status')
        if status and status.lower() != 'all':
            qs = qs.filter(status=status.lower())
        method = params.get('method')
        if method and method.lower() != 'all':
            qs = qs.filter(method=method.lower())
        if params.get('from'):
            qs = qs.filter(created_at__gte=_parse_bound(params['from'], False))
        if params.get('to'):
            qs = qs.filter(created_at__lte=_parse_bound(params['to'], True))
        search = params.get('search') or params.get('q')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(number__icontains=search) | Q(customer_name__icontains=search) |
                           Q(phone__icontains=search) | Q(pin__icontains=search) |
                           Q(items__design_code__icontains=search)).distinct()
        return qs

    def list(self, request, *args, **kwargs):
        return ok(OrderSerializer(self.get_queryset(), many=True).data, 'Orders')

    def retrieve(self, request, *args, **kwargs):
        return ok(OrderSerializer(self.get_object()).data, 'Order')

    def create(self, request, *args, **kwargs):
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        customer = d['customer']
        for field in ('name', 'phone'):
            if not str(customer.get(field, '')).strip():
                raise ValidationError({field: f'customer.{field} is required.'})
        order = services.create_order(
            customer=customer, items=d['items'], method=d['method'],
            payment_mode=d['payment_mode'], payment_amount=d['payment_amount'],
            payment_status=d['payment_status'], expected_date=d.get('expected_date'),
            note=d.get('note', ''), created_by=request.user,
        )
        return created(OrderSerializer(order).data, 'Order created')

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        serializer = OrderPatchSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        for field, value in d.items():
            setattr(order, field, value)
        order.save()
        return ok(OrderSerializer(order).data, 'Order updated')

    def get_object(self):
        try:
            return Order.objects.prefetch_related('items', 'history').select_related('linked_sale').get(number=self.kwargs['pk'])
        except Order.DoesNotExist:
            raise NotFound('Order not found')

    @action(detail=True, methods=['post'])
    def status(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        order = services.transition_status(order, d['status'], note=d.get('note', ''), by=request.user)
        return ok(OrderSerializer(order).data, f"Order marked {dict(STATUSES).get(d['status'], d['status'])}")

    @action(detail=True, methods=['post'])
    def fulfill(self, request, pk=None):
        order = self.get_object()
        already = bool(order.linked_sale_id)
        order = services.fulfill_order(order, created_by=request.user)
        message = (f'Already fulfilled — sale {order.linked_sale.number} recorded earlier'
                   if already else 'Order fulfilled — sale recorded')
        return ok(OrderSerializer(order).data, message)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        order = self.get_object()
        return ok(OrderStatusHistorySerializer(order.history.all(), many=True).data, 'Status history')


@extend_schema(tags=['Delivery'], summary='Waiting-for-stock radar')
class WaitingRadarView(APIView):
    """Which customers are queued for which out-of-stock / low-stock design."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = Order.objects.filter(status='waiting-stock').prefetch_related('items__design')
        rows = []
        for o in orders:
            rows.append({
                'order': o.number,
                'customer': o.customer_name,
                'phone': o.phone,
                'items': [{'design_code': i.design_code, 'name': i.name, 'qty': i.qty,
                           'design_quantity': i.design.quantity} for i in o.items.all()],
                'since': o.created_at.isoformat(),
            })
        return ok(rows, 'Waiting-for-stock orders')
