from decimal import Decimal

from rest_framework import serializers

from .models import Sale, SaleItem, PAYMENT_METHODS


class SaleItemSerializer(serializers.ModelSerializer):
    design_id = serializers.CharField(source='design_code', read_only=True)

    class Meta:
        model = SaleItem
        fields = ['id', 'design_id', 'design_code', 'name', 'category', 'qty',
                  'unit_price', 'unit_cost', 'line_total']


class SaleSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='number', read_only=True)
    number = serializers.CharField(read_only=True)
    items = SaleItemSerializer(many=True, read_only=True)
    lines = SaleItemSerializer(many=True, read_only=True)  # frontend alias
    poster_count = serializers.SerializerMethodField()
    cogs = serializers.SerializerMethodField()
    gross_profit = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = ['id', 'number', 'date', 'gross', 'discount', 'total', 'net',
                  'payment', 'status', 'cancel_reason', 'note',
                  'items', 'lines', 'poster_count', 'cogs', 'gross_profit',
                  'created_at', 'updated_at']

    net = serializers.DecimalField(source='total', max_digits=12, decimal_places=2, read_only=True)

    def get_poster_count(self, obj):
        return sum(i.qty for i in obj.items.all())

    def get_cogs(self, obj):
        cogs = sum((Decimal(i.qty) * i.unit_cost for i in obj.items.all()), Decimal('0'))
        return str(cogs.quantize(Decimal('0.01')))

    def get_gross_profit(self, obj):
        cogs = sum((Decimal(i.qty) * i.unit_cost for i in obj.items.all()), Decimal('0'))
        return str((obj.total - cogs).quantize(Decimal('0.01')))


class SaleCreateLineSerializer(serializers.Serializer):
    design_code = serializers.CharField()
    qty = serializers.IntegerField(min_value=1)


class SaleCreateSerializer(serializers.Serializer):
    lines = SaleCreateLineSerializer(many=True)
    payment = serializers.ChoiceField(choices=[m for m, _ in PAYMENT_METHODS], default='UPI')
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0,
                                        required=False, allow_null=True, default=None)
    date = serializers.DateTimeField(required=False)


class CancelSaleSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)
