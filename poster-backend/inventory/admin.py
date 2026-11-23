from django.contrib import admin
from .models import Design, PrintBatch

class PrintBatchInline(admin.TabularInline):
    model = PrintBatch
    extra = 0
    readonly_fields = ('code',)

@admin.register(Design)
class DesignAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'price', 'quantity', 'avg_cost', 'archived')
    search_fields = ('code', 'name')
    list_filter = ('category', 'archived')
    inlines = [PrintBatchInline]
