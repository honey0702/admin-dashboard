from rest_framework import serializers

from .models import Order, OrderItem, OrderStatusHistory


class OrderItemSerializer(serializers.ModelSerializer):
    design_id = serializers.CharField(source='design_code', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'design_id', 'design_code', 'name', 'qty']


class OrderStatusHistorySerializer(serializers.ModelSerializer):
    by = serializers.CharField(source='by.username', default=None, read_only=True)

    class Meta:
        model = OrderStatusHistory
        fields = ['id', 'status', 'at', 'by', 'note']


class OrderSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='number', read_only=True)
    number = serializers.CharField(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    history = OrderStatusHistorySerializer(many=True, read_only=True)
    customer = serializers.SerializerMethodField()
    payment = serializers.SerializerMethodField()
    linked_sale = serializers.CharField(source='linked_sale.number', default=None, read_only=True)
    method = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ['id', 'number', 'customer', 'customer_name', 'phone', 'address', 'area', 'city', 'pin',
                  'method', 'status', 'expected_date', 'dispatched_at', 'delivered_at',
                  'payment', 'payment_mode', 'payment_amount', 'payment_status',
                  'note', 'linked_sale', 'items', 'history',
                  'assigned_to', 'created_at', 'updated_at']

    def get_customer(self, obj):
        return {'name': obj.customer_name, 'phone': obj.phone, 'address': obj.address,
                'area': obj.area, 'city': obj.city, 'pin': obj.pin}

    def get_payment(self, obj):
        return {'mode': obj.payment_mode, 'amount': str(obj.payment_amount), 'status': obj.payment_status}

    METHOD_MAP = {'home-delivery': 'Home Delivery', 'pickup': 'Customer Pickup'}

    def get_method(self, obj):
        return self.METHOD_MAP.get(obj.method, obj.method)


class OrderCreateItemSerializer(serializers.Serializer):
    design_code = serializers.CharField()
    qty = serializers.IntegerField(min_value=1)


class OrderCreateSerializer(serializers.Serializer):
    customer = serializers.DictField()
    items = OrderCreateItemSerializer(many=True)
    method = serializers.ChoiceField(choices=[('home-delivery', 'home-delivery'), ('pickup', 'pickup'),
                                              ('Home Delivery', 'Home Delivery'), ('Customer Pickup', 'Customer Pickup')])
    payment_mode = serializers.ChoiceField(choices=['Cash', 'UPI', 'Card', 'Bank', 'Other'], default='UPI')
    payment_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, default=0)
    payment_status = serializers.ChoiceField(choices=['paid', 'unpaid'], default='unpaid')
    expected_date = serializers.DateField(required=False, allow_null=True, default=None)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')

    METHOD_LOOKUP = {'home-delivery': 'home-delivery', 'pickup': 'pickup',
                     'Home Delivery': 'home-delivery', 'Customer Pickup': 'pickup'}

    def validate_method(self, value):
        return self.METHOD_LOOKUP[value]


class OrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['request-received', 'waiting-stock', 'ready-pickup',
                                              'out-for-delivery', 'delivered', 'not-delivered', 'cancelled'])
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


class OrderPatchSerializer(serializers.Serializer):
    customer_name = serializers.CharField(max_length=120, required=False)
    phone = serializers.CharField(max_length=20, required=False)
    address = serializers.CharField(max_length=255, required=False, allow_blank=True)
    area = serializers.CharField(max_length=80, required=False, allow_blank=True)
    city = serializers.CharField(max_length=80, required=False)
    pin = serializers.CharField(max_length=10, required=False, allow_blank=True)
    method = serializers.ChoiceField(choices=['home-delivery', 'pickup'], required=False)
    expected_date = serializers.DateField(required=False, allow_null=True)
    payment_mode = serializers.ChoiceField(choices=['Cash', 'UPI', 'Card', 'Bank', 'Other'], required=False)
    payment_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False)
    payment_status = serializers.ChoiceField(choices=['paid', 'unpaid'], required=False)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)
