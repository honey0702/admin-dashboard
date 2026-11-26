import re

from rest_framework import serializers

from .models import Order, OrderItem, OrderStatusHistory

# Same rules as the frontend (poster-dashboard/src/lib/validate.js):
#  - name: letters + spaces only, >= 2 chars (no digits / symbols)
#  - phone: 10-digit Indian mobile with optional +91/91 prefix, starts 6-9;
#    stored normalized as +91XXXXXXXXXX
#  - PIN: optional, but if present must be a 6-digit Indian PIN (starts 1-8)
#  - address: required for delivery orders
PHONE_RE = re.compile(r'^(?:\+?91)?([6-9]\d{9})$')
PIN_RE = re.compile(r'^[1-8]\d{5}$')


def validate_name(value):
    name = str(value or '').strip()
    if len(name) < 2:
        raise serializers.ValidationError('Customer name is too short.')
    if not all(ch.isalpha() or ch == ' ' for ch in name):
        raise serializers.ValidationError('Name can contain letters and spaces only — no numbers or symbols.')
    return name


def normalize_phone(value):
    cleaned = re.sub(r'[\s-]', '', str(value or ''))
    m = PHONE_RE.match(cleaned)
    if not m:
        raise serializers.ValidationError('Enter a valid 10-digit mobile number (with +91 country code), starting with 6–9.')
    return f'+91{m.group(1)}'


def validate_pin(value):
    pin = str(value or '').strip()
    if not pin:
        return ''
    if not PIN_RE.match(pin):
        raise serializers.ValidationError('PIN code must be 6 digits and start with 1–8.')
    return pin


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

    def validate(self, attrs):
        customer = dict(attrs.get('customer') or {})
        name = str(customer.get('name', '')).strip()
        if not name:
            raise serializers.ValidationError({'customer': {'name': 'Customer name is required.'}})
        customer['name'] = validate_name(name)

        phone = str(customer.get('phone', '')).strip()
        if not phone:
            raise serializers.ValidationError({'customer': {'phone': 'Mobile number is required.'}})
        customer['phone'] = normalize_phone(phone)

        address = str(customer.get('address', '')).strip()
        if len(address) < 3:
            raise serializers.ValidationError({'customer': {'address': 'Address is required — building, society or landmark.'}})
        customer['address'] = address

        customer['pin'] = validate_pin(customer.get('pin', ''))
        customer['area'] = str(customer.get('area', '')).strip()
        customer['city'] = str(customer.get('city', '')).strip() or 'Surat'
        attrs['customer'] = customer
        return attrs


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

    def validate_customer_name(self, value):
        return validate_name(value)

    def validate_phone(self, value):
        return normalize_phone(value)

    def validate_pin(self, value):
        return validate_pin(value)
    method = serializers.ChoiceField(choices=['home-delivery', 'pickup'], required=False)
    expected_date = serializers.DateField(required=False, allow_null=True)
    payment_mode = serializers.ChoiceField(choices=['Cash', 'UPI', 'Card', 'Bank', 'Other'], required=False)
    payment_amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False)
    payment_status = serializers.ChoiceField(choices=['paid', 'unpaid'], required=False)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True)
