from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from core.models import TimeStampedModel

METHODS = [('home-delivery', 'Home Delivery'), ('pickup', 'Customer Pickup')]
STATUSES = [
    ('request-received', 'Request Received'),
    ('waiting-stock', 'Waiting for Stock'),
    ('ready-pickup', 'Ready for Pickup'),
    ('out-for-delivery', 'Out for Delivery'),
    ('delivered', 'Delivered'),
    ('not-delivered', 'Not Delivered'),
    ('cancelled', 'Cancelled'),
]
TERMINAL_STATUSES = {'delivered', 'cancelled'}
PAYMENT_MODES = [('Cash', 'Cash'), ('UPI', 'UPI'), ('Card', 'Card'), ('Bank', 'Bank'), ('Other', 'Other')]
PAYMENT_STATUS = [('paid', 'Paid'), ('unpaid', 'Unpaid')]


class Order(TimeStampedModel):
    number = models.CharField(max_length=12, unique=True, db_index=True)     # HD-0001
    customer_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20)
    address = models.CharField(max_length=255, blank=True)
    area = models.CharField(max_length=80, blank=True)
    city = models.CharField(max_length=80, default='Surat')
    pin = models.CharField(max_length=10, blank=True)

    method = models.CharField(max_length=16, choices=METHODS, default='home-delivery')
    status = models.CharField(max_length=20, choices=STATUSES, default='request-received', db_index=True)

    expected_date = models.DateField(null=True, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    payment_mode = models.CharField(max_length=8, choices=PAYMENT_MODES, default='UPI')
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_status = models.CharField(max_length=8, choices=PAYMENT_STATUS, default='unpaid')

    note = models.CharField(max_length=255, blank=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='assigned_orders')
    linked_sale = models.OneToOneField('sales.Sale', null=True, blank=True,
                                       on_delete=models.SET_NULL, related_name='order')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='orders')

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status']), models.Index(fields=['-created_at'])]

    def __str__(self):
        return self.number


class OrderItem(TimeStampedModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    design = models.ForeignKey('inventory.Design', on_delete=models.PROTECT, related_name='order_items')
    design_code = models.CharField(max_length=12)
    name = models.CharField(max_length=160)
    qty = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    def __str__(self):
        return f'{self.order_id}: {self.qty} × {self.design_code}'


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='history')
    status = models.CharField(max_length=20, choices=STATUSES)
    at = models.DateTimeField(auto_now_add=True)
    by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                           on_delete=models.SET_NULL, related_name='+')
    note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['at']
        verbose_name_plural = 'order status histories'
