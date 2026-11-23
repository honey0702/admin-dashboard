from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import CheckConstraint, Q

from core.models import TimeStampedModel


class Design(TimeStampedModel):
    """A poster design (product SKU). Stock lives here; costing from batches."""
    code = models.CharField(max_length=12, unique=True, db_index=True)  # e.g. D001
    name = models.CharField(max_length=160)
    category = models.ForeignKey('core.Category', on_delete=models.PROTECT, related_name='designs')
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='designs/', blank=True, null=True)

    price = models.DecimalField(max_digits=10, decimal_places=2,
                                validators=[MinValueValidator(Decimal('0'))])
    quantity = models.IntegerField(default=0)           # copies on hand (derived, kept denormalized + ledgered)
    min_stock = models.PositiveIntegerField(default=5)  # low-stock threshold for this design
    avg_cost = models.DecimalField(max_digits=10, decimal_places=4, default=0)  # weighted avg unit cost (print+sleeve)

    damaged_quantity = models.PositiveIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)
    rights = models.CharField(max_length=160, blank=True)
    archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['code']
        constraints = [CheckConstraint(condition=Q(quantity__gte=0), name='quantity_non_negative')]
        indexes = [models.Index(fields=['archived', 'quantity'])]

    @property
    def stock_value(self):
        return (self.quantity * self.avg_cost).quantize(Decimal('0.01'))

    @property
    def is_out_of_stock(self):
        return self.quantity == 0

    @property
    def is_low_stock(self):
        return 0 < self.quantity <= self.min_stock

    def __str__(self):
        return f'{self.code} — {self.name}'


class PrintBatch(TimeStampedModel):
    """One print run for a design. Historical costs are preserved forever."""
    code = models.CharField(max_length=20, unique=True, db_index=True)  # e.g. D001-B1
    design = models.ForeignKey(Design, on_delete=models.CASCADE, related_name='batches')
    date = models.DateField()
    copies = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    print_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                     validators=[MinValueValidator(Decimal('0'))])   # per copy
    sleeve_cost = models.DecimalField(max_digits=10, decimal_places=2,
                                      validators=[MinValueValidator(Decimal('0'))])  # per copy
    note = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ['-date', 'id']

    @property
    def unit_cost(self):
        return self.print_cost + self.sleeve_cost

    @property
    def total_cost(self):
        return self.copies * self.unit_cost

    def __str__(self):
        return f'{self.code} ({self.copies} copies)'
