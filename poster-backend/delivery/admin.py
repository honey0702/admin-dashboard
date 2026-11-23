from django.contrib import admin
from .models import Order, OrderItem, OrderStatusHistory

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

class OrderStatusHistoryInline(admin.TabularInline):
    model = OrderStatusHistory
    extra = 0
    readonly_fields = ('at',)

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('number', 'customer_name', 'phone', 'status', 'method', 'payment_status', 'created_at')
    list_filter = ('status', 'method')
    search_fields = ('number', 'customer_name', 'phone')
    inlines = [OrderItemInline, OrderStatusHistoryInline]
