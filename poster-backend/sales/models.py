from django.conf import settings
from django.db import models

from core.models import TimeStampedModel

PAYMENT_METHODS = [('Cash', 'Cash'), ('UPI', 'UPI'), ('Card', 'Card'), ('Bank', 'Bank'), ('Other', 'Other')]
SALE_STATUS = [('completed', 'Completed'), ('cancelled', 'Cancelled')]


class Sale(TimeStampedModel):
    number = models.CharField(max_length=20, unique=True, db_index=True)   # S-2026-0001
    date = models.DateTimeField()
    gross = models.DecimalField(max_digits=12, decimal_places=2)           # before discount
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2)           # what the customer paid
    payment = models.CharField(max_length=8, choices=PAYMENT_METHODS, default='UPI')
    status = models.CharField(max_length=12, choices=SALE_STATUS, default='completed', db_index=True)
    cancel_reason = models.CharField(max_length=255, blank=True)
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='sales')

    class Meta:
        ordering = ['-date']
        indexes = [models.Index(fields=['-date']), models.Index(fields=['status'])]

    def __str__(self):
        return self.number


class SaleItem(TimeStampedModel):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    design = models.ForeignKey('inventory.Design', on_delete=models.PROTECT, related_name='sale_items')
    # snapshots — survive later renames/price changes
    design_code = models.CharField(max_length=12)
    name = models.CharField(max_length=160)
    category = models.CharField(max_length=80)
    qty = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=4)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.sale_id}: {self.qty} × {self.design_code}'
