from django.contrib import admin
from .models import Category, DiscountRule, DocumentCounter, ShopProfile, StockMovement

admin.site.register(Category)
admin.site.register(ShopProfile)
admin.site.register(DiscountRule)
admin.site.register(StockMovement)
admin.site.register(DocumentCounter)
