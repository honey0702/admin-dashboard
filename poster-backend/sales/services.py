"""Sale pipeline: prices/COGS from the database, never from the client."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.models import DiscountRule, StockMovement, next_sale_number
from inventory.models import Design
from sales.models import Sale


def suggested_discount(poster_count: int) -> Decimal:
    """Highest qualifying enabled tier."""
    rule = (DiscountRule.objects
            .filter(enabled=True, min_qty__lte=poster_count)
            .order_by('-min_qty').first())
    return rule.save_amount if rule else Decimal('0')


class SaleValidationError(Exception):
    def __init__(self, message, field=None):
        super().__init__(message)
        self.message = message
        self.field = field


@transaction.atomic
def create_sale(*, lines, payment, note='', discount=None, created_by=None, date=None):
    """
    lines: iterable of {'design_code': 'D001', 'qty': 2}
    discount: optional explicit ₹ discount. If None, the enabled combo rules decide.
              Clamped to [0, gross] in all cases — a discount can never exceed the bill.
    """
    if not lines:
        raise SaleValidationError('A sale needs at least one line.')

    codes = [l['design_code'] for l in lines]
    if len(codes) != len(set(codes)):
        raise SaleValidationError('Duplicate design in lines. Merge quantities instead.')

    designs = {d.code: d for d in Design.objects.select_for_update().filter(code__in=codes)}

    items, gross, poster_count = [], Decimal('0'), 0
    for l in lines:
        code = l['design_code']
        design = designs.get(code)
        if design is None:
            raise SaleValidationError(f'Unknown design {code}.', 'design_code')
        qty = int(l.get('qty', 0))
        if qty < 1:
            raise SaleValidationError(f'Quantity for {code} must be at least 1.', 'qty')
        if design.quantity < qty:
            raise SaleValidationError(
                f'Not enough stock of {code} ({design.name}): {design.quantity} left, asked for {qty}.',
                'stock')
        line_total = Decimal(qty) * design.price
        gross += line_total
        poster_count += qty
        items.append((design, qty, line_total))

    if discount is None:
        discount = suggested_discount(poster_count)
    else:
        discount = Decimal(str(discount))
        if discount < 0:
            raise SaleValidationError('Discount cannot be negative.', 'discount')
    discount = min(discount, gross)
    total = gross - discount

    sale = Sale.objects.create(
        number=next_sale_number(date),
        date=date or timezone.now(),
        gross=gross, discount=discount, total=total,
        payment=payment, note=note, created_by=created_by,
    )
    for design, qty, line_total in items:
        from .models import SaleItem
        SaleItem.objects.create(
            sale=sale, design=design,
            design_code=design.code, name=design.name, category=design.category.name,
            qty=qty, unit_price=design.price, unit_cost=design.avg_cost, line_total=line_total,
        )
        design.quantity -= qty
        design.save(update_fields=['quantity', 'updated_at'])
        StockMovement.objects.create(
            design=design, delta=-qty, reason='sale', reference=sale.number,
            note='', created_by=created_by,
        )
    return sale


@transaction.atomic
def cancel_sale(sale, *, reason, created_by=None):
    from rest_framework.exceptions import ValidationError
    sale = Sale.objects.select_for_update().prefetch_related('items').get(pk=sale.pk)
    if sale.status == 'cancelled':
        raise ValidationError({'status': 'Sale is already cancelled.'})
    for item in sale.items.all():
        design = Design.objects.select_for_update().get(pk=item.design_id)
        design.quantity += item.qty
        design.save(update_fields=['quantity', 'updated_at'])
        StockMovement.objects.create(
            design=design, delta=item.qty, reason='sale-cancelled',
            reference=sale.number, note=reason, created_by=created_by,
        )
    sale.status = 'cancelled'
    sale.cancel_reason = reason
    sale.save(update_fields=['status', 'cancel_reason', 'updated_at'])
    return sale
