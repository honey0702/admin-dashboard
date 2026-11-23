from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel

EXPENSE_KINDS = [('one-time', 'One-time'), ('recurring', 'Recurring')]
PAYMENT_MODES = [('Cash', 'Cash'), ('UPI', 'UPI'), ('Card', 'Card'), ('Bank', 'Bank')]


class ExpenseCategory(TimeStampedModel):
    """Manageable without code changes — full CRUD via /api/expense-categories/."""
    name = models.CharField(max_length=80, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'expense categories'

    def __str__(self):
        return self.name


class Expense(TimeStampedModel):
    code = models.CharField(max_length=12, unique=True, db_index=True)   # E-1001
    title = models.CharField(max_length=160)                              # e.g. 'Tea and water for stall'
    description = models.TextField(blank=True)
    category = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    amount = models.DecimalField(max_digits=12, decimal_places=2,
                                 validators=[MinValueValidator(0)])
    date = models.DateTimeField()                                         # expense date (may differ from created)
    mode = models.CharField(max_length=8, choices=PAYMENT_MODES, default='Cash')
    kind = models.CharField(max_length=12, choices=EXPENSE_KINDS, default='one-time')
    note = models.CharField(max_length=255, blank=True)
    receipt = models.ImageField(upload_to='receipts/', blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='expenses')

    class Meta:
        ordering = ['-date']
        indexes = [models.Index(fields=['-date']), models.Index(fields=['category'])]

    def __str__(self):
        return f'{self.code} — {self.title}'
