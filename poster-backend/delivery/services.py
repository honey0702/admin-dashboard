"""Order pipeline business logic."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import next_order_number
from .models import Order, OrderItem, OrderStatusHistory, TERMINAL_STATUSES


@transaction.atomic
def create_order(*, customer, items, method, payment_mode, payment_amount, payment_status,
                 expected_date=None, note='', created_by=None):
    from inventory.models import Design
    codes = [i['design_code'] for i in items]
    designs = {d.code: d for d in Design.objects.filter(code__in=codes)}
    for i in items:
        if i['design_code'] not in designs:
            raise ValidationError({'items': f"Unknown design {i['design_code']}."})
        if int(i.get('qty', 0)) < 1:
            raise ValidationError({'items': f"Quantity for {i['design_code']} must be at least 1."})

    order = Order.objects.create(
        number=next_order_number(),
        customer_name=customer['name'].strip(),
        phone=customer['phone'].strip(),
        address=customer.get('address', '').strip(),
        area=customer.get('area', '').strip(),
        city=customer.get('city', 'Surat').strip() or 'Surat',
        pin=customer.get('pin', '').strip(),
        method=method,
        expected_date=expected_date,
        payment_mode=payment_mode,
        payment_amount=payment_amount,
        payment_status=payment_status,
        note=note,
        created_by=created_by,
    )
    for i in items:
        d = designs[i['design_code']]
        OrderItem.objects.create(order=order, design=d, design_code=d.code, name=d.name, qty=int(i['qty']))
    OrderStatusHistory.objects.create(order=order, status=order.status, by=created_by, note='Order created')
    return order


@transaction.atomic
def transition_status(order, status, *, note='', by=None):
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.status in TERMINAL_STATUSES:
        raise ValidationError({'status': f'Order {order.number} is {order.status} and cannot be changed.'})
    if status == order.status:
        return order
    if status == 'delivered' and not order.linked_sale_id:
        order = fulfill_order(order, created_by=by)
    order.status = status
    now = timezone.now()
    if status == 'out-for-delivery':
        order.dispatched_at = now
    elif status == 'delivered':
        order.delivered_at = now
    order.save(update_fields=['status', 'dispatched_at', 'delivered_at', 'updated_at'])
    OrderStatusHistory.objects.create(order=order, status=status, by=by, note=note)
    return order


@transaction.atomic
def fulfill_order(order, *, created_by=None):
    """Create the real sale for this order (idempotent). Stock is reserved here, atomically."""
    from sales.services import create_sale
    order = Order.objects.select_for_update().prefetch_related('items__design').get(pk=order.pk)
    if order.status == 'cancelled':
        raise ValidationError({'status': 'A cancelled order cannot be fulfilled.'})
    if order.linked_sale_id:
        return order  # already fulfilled — no duplicate sale
    lines = [{'design_code': i.design_code, 'qty': i.qty} for i in order.items.all()]
    from sales.services import SaleValidationError
    try:
        sale = create_sale(lines=lines, payment=order.payment_mode, note=f'Home delivery · {order.number}',
                           discount=None, created_by=created_by)
    except SaleValidationError as exc:
        raise ValidationError({exc.field or 'sale': exc.message}) from exc
    order.linked_sale = sale
    order.payment_status = 'paid' if order.payment_status == 'unpaid' else order.payment_status
    order.save(update_fields=['linked_sale', 'payment_status', 'updated_at'])
    OrderStatusHistory.objects.create(order=order, status=order.status, by=created_by,
                                      note=f'Fulfilled — sale {sale.number} recorded')
    return order
