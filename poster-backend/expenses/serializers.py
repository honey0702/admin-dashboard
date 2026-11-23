from django.utils import timezone
from rest_framework import serializers

from core.models import next_expense_code
from .models import Expense, ExpenseCategory


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseCategory
        fields = ['id', 'name', 'is_active', 'created_at']


class ExpenseSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='code', read_only=True)
    code = serializers.CharField(read_only=True)
    category = serializers.CharField(max_length=80)
    amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    receipt_url = serializers.SerializerMethodField()

    class Meta:
        model = Expense
        fields = ['id', 'code', 'title', 'description', 'category', 'amount', 'date',
                  'mode', 'kind', 'note', 'receipt', 'receipt_url', 'created_at', 'updated_at']

    def to_representation(self, obj):
        data = super().to_representation(obj)
        data['category'] = obj.category.name if obj.category else None
        return data

    def get_receipt_url(self, obj):
        if obj.receipt:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.receipt.url) if request else obj.receipt.url
        return None

    @staticmethod
    def _category_obj(name):
        clean = ' '.join(name.split()).strip()
        cat = ExpenseCategory.objects.filter(name__iexact=clean).first()
        return cat or ExpenseCategory.objects.create(name=clean)

    def create(self, validated_data):
        validated_data['category'] = self._category_obj(validated_data.pop('category'))
        validated_data['code'] = next_expense_code()
        validated_data.setdefault('date', timezone.now())
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'category' in validated_data:
            validated_data['category'] = self._category_obj(validated_data.pop('category'))
        return super().update(instance, validated_data)

