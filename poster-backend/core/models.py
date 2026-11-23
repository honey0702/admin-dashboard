"""Shared building blocks: base model, sequences, shop settings, discount rules, stock ledger."""
from django.conf import settings
from django.db import models, transaction
from django.utils import timezone


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class DocumentCounter(models.Model):
    """Atomic per-year (or global) sequence for human-friendly document numbers."""
    name = models.CharField(max_length=40, primary_key=True)
    seq = models.BigIntegerField(default=0)

    @classmethod
    def next(cls, key):
        with transaction.atomic():
            counter, _ = cls.objects.select_for_update().get_or_create(name=key, defaults={'seq': 0})
            counter.seq += 1
            counter.save(update_fields=['seq'])
            return counter.seq


def next_sale_number(date=None):
    date = date or timezone.now()
    year = date.year
    seq = DocumentCounter.next(f'sale-{year}')
    return f'S-{year}-{seq:04d}'


def next_expense_code():
    seq = DocumentCounter.next('expense')
    return f'E-{1000 + seq}'


def next_order_number():
    seq = DocumentCounter.next('order')
    return f'HD-{seq:04d}'


class Category(TimeStampedModel):
    """Poster product category (feeds the inventory catalogue)."""
    name = models.CharField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class ShopProfile(TimeStampedModel):
    """Singleton row holding the business profile / shop preferences."""
    business_name = models.CharField(max_length=120, default='Rang Poster Co.')
    owner_name = models.CharField(max_length=120, default='Owner')
    owner_role = models.CharField(max_length=60, default='Owner')
    phone = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    currency = models.CharField(max_length=3, default='INR')
    default_price = models.DecimalField(max_digits=10, decimal_places=2, default=60)
    default_payment = models.CharField(max_length=12, default='UPI')
    low_stock_threshold = models.PositiveIntegerField(default=5)
    break_even_target = models.DecimalField(max_digits=12, decimal_places=2, default=25000)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = 'shop profile'

    def __str__(self):
        return self.business_name


class DiscountRule(TimeStampedModel):
    """Tiered combo discount: buy `min_qty` posters, save `save_amount` rupees."""
    min_qty = models.PositiveIntegerField(unique=True)
    save_amount = models.DecimalField(max_digits=10, decimal_places=2)
    enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ['min_qty']

    def __str__(self):
        return f'{self.min_qty}+ posters save ₹{self.save_amount}'


class StockMovement(TimeStampedModel):
    """Append-only stock ledger — every change to Design.quantity lands here."""
    REASONS = [
        ('restock', 'Restock'),
        ('sale', 'Sale'),
        ('sale-cancelled', 'Sale cancelled — stock restored'),
        ('damage', 'Damaged stock'),
        ('adjustment', 'Manual adjustment'),
        ('order-fulfilled', 'Home delivery order fulfilled'),
    ]
    design = models.ForeignKey('inventory.Design', on_delete=models.CASCADE, related_name='movements')
    delta = models.IntegerField()  # signed change
    reason = models.CharField(max_length=24, choices=REASONS)
    reference = models.CharField(max_length=40, blank=True)  # e.g. sale/order number
    note = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='stock_movements')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['design', '-created_at']), models.Index(fields=['reference'])]

    def __str__(self):
        return f'{self.design_id} {self.delta:+d} ({self.reason})'
