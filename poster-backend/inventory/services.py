"""Inventory business logic — all stock mutations go through here, atomically."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.models import StockMovement

from .models import Design


@transaction.atomic
def apply_batch(batch):
    """Apply a brand-new print batch: stock up + weighted-average cost."""
    design = Design.objects.select_for_update().get(pk=batch.design_id)
    before_qty = design.quantity
    before_value = Decimal(before_qty) * design.avg_cost
    added_value = Decimal(batch.copies) * (batch.print_cost + batch.sleeve_cost)
    new_qty = before_qty + batch.copies
    design.quantity = new_qty
    design.avg_cost = (before_value + added_value) / Decimal(new_qty)
    design.save(update_fields=['quantity', 'avg_cost', 'updated_at'])
    StockMovement.objects.create(
        design=design, delta=batch.copies, reason='restock',
        reference=batch.code, note=batch.note or 'Print batch added',
    )
    return design


@transaction.atomic
def adjust_stock(design_id, delta, reason, reference='', note='', user=None):
    design = Design.objects.select_for_update().get(pk=design_id)
    new_qty = design.quantity + delta
    if new_qty < 0:
        from rest_framework.exceptions import ValidationError
        raise ValidationError({'stock': f'Stock cannot go below zero (only {design.quantity} left of {design.code}).'})
    design.quantity = new_qty
    design.save(update_fields=['quantity', 'updated_at'])
    StockMovement.objects.create(
        design=design, delta=delta, reason=reason,
        reference=reference, note=note, created_by=user,
    )
    return design


def weighted_unit_cost(batches):
    copies = sum(b.copies for b in batches)
    if not copies:
        return Decimal('0')
    total = sum(Decimal(b.copies) * (b.print_cost + b.sleeve_cost) for b in batches)
    return (total / Decimal(copies)).quantize(Decimal('0.0001'))

