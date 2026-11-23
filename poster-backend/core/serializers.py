from rest_framework import serializers

from core.models import Category, DiscountRule, ShopProfile


class ShopProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopProfile
        fields = ['business_name', 'owner_name', 'owner_role', 'phone', 'address',
                  'currency', 'default_price', 'default_payment', 'low_stock_threshold',
                  'break_even_target']


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'is_active', 'created_at']


class DiscountRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiscountRule
        fields = ['id', 'min_qty', 'save_amount', 'enabled', 'created_at']
