from django.contrib import admin
from .models import Sale, SaleItem

class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'total', 'payment', 'status')
    list_filter = ('status', 'payment')
    search_fields = ('number',)
    inlines = [SaleItemInline]
