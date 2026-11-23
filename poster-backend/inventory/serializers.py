from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from core.models import Category, StockMovement
from .models import Design, PrintBatch
from . import services


class PrintBatchSerializer(serializers.ModelSerializer):
    design = serializers.CharField(source='design.code', read_only=True)
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)
    total_cost = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PrintBatch
        fields = ['id', 'code', 'design', 'date', 'copies', 'print_cost', 'sleeve_cost',
                  'unit_cost', 'total_cost', 'note', 'created_at']
        read_only_fields = ['id', 'code', 'unit_cost', 'total_cost', 'created_at']


class BatchCreateSerializer(serializers.Serializer):
    date = serializers.DateField(required=False)
    copies = serializers.IntegerField(min_value=1)
    print_cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    sleeve_cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    note = serializers.CharField(max_length=120, required=False, allow_blank=True, default='')


class DesignSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='code', read_only=True)
    code = serializers.CharField(read_only=True)
    category = serializers.CharField(source='category.name', read_only=True)
    batches = PrintBatchSerializer(many=True, read_only=True)
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    is_out_of_stock = serializers.BooleanField(read_only=True)
    image_url = serializers.SerializerMethodField()
    unit_cost = serializers.DecimalField(source='avg_cost', max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = Design
        fields = ['id', 'code', 'name', 'category', 'description', 'price', 'quantity',
                  'min_stock', 'avg_cost', 'unit_cost', 'stock_value', 'damaged_quantity',
                  'notes', 'rights', 'archived', 'batches', 'image_url',
                  'is_low_stock', 'is_out_of_stock', 'created_at', 'updated_at']
        read_only_fields = ['code', 'avg_cost', 'damaged_quantity', 'created_at', 'updated_at']

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return None


class DesignWriteSerializer(serializers.ModelSerializer):
    """Create/update a design. Accepts category name; price/qty validated."""
    category = serializers.CharField(write_only=True)
    code = serializers.CharField(max_length=12, required=False, write_only=True)
    initial_copies = serializers.IntegerField(min_value=0, required=False, default=0, write_only=True)
    print_cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, write_only=True)
    sleeve_cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False, write_only=True)

    class Meta:
        model = Design
        fields = ['code', 'name', 'category', 'description', 'price', 'min_stock', 'notes', 'rights',
                  'image', 'initial_copies', 'print_cost', 'sleeve_cost']

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Price cannot be negative.')
        return value

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Name is required.')
        return value

    def _category(self, name):
        clean = ' '.join(name.split()).strip()
        cat = Category.objects.filter(name__iexact=clean).first()
        if cat is None:
            cat = Category.objects.create(name=clean)
        return cat

    @transaction.atomic
    def create(self, validated_data):
        copies = validated_data.pop('initial_copies', 0) or 0
        print_cost = validated_data.pop('print_cost', None)
        sleeve_cost = validated_data.pop('sleeve_cost', None)
        category = self._category(validated_data.pop('category'))
        requested_code = validated_data.pop('code', None)
        if requested_code and Design.objects.filter(code=requested_code).exists():
            raise serializers.ValidationError({'code': 'This code is already in use.'})
        # next D-code from the highest existing code (not the pk)
        import re
        highest = 0
        for code in Design.objects.select_for_update().values_list('code', flat=True):
            m = re.match(r'^D(\d+)$', code)
            if m:
                highest = max(highest, int(m.group(1)))
        next_code = requested_code or f'D{highest + 1:03d}'
        design = Design(category=category, code=next_code, quantity=0, **validated_data)
        design.save()
        if copies > 0:
            batch = PrintBatch.objects.create(
                code=f'{design.code}-B1', design=design, date=timezone.now().date(), copies=copies,
                print_cost=print_cost if print_cost is not None else max(design.price * Decimal('0.18'), Decimal('1')),
                sleeve_cost=sleeve_cost if sleeve_cost is not None else Decimal('2.50'),
                note='Opening batch',
            )
            services.apply_batch(batch)
        return design


class DamageSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


class StockMovementSerializer(serializers.ModelSerializer):
    design = serializers.CharField(source='design.code', read_only=True)

    class Meta:
        model = StockMovement
        fields = ['id', 'design', 'delta', 'reason', 'reference', 'note', 'created_at', 'created_by']
