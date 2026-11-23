from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.permissions import IsOwner, IsOwnerOrReadOnly
from core.models import Category, DiscountRule, ShopProfile
from core.responses import ok, created
from .backup import dump_state, restore_state
from .serializers import (
    CategorySerializer, DiscountRuleSerializer, ShopProfileSerializer,
)


@extend_schema(tags=['Core'], summary='Health check (public)')
class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        from django.db import connection
        try:
            with connection.cursor() as cur:
                cur.execute('SELECT 1')
            db = 'ok'
        except Exception:
            db = 'unavailable'
        return Response({'success': True, 'message': 'Rang Poster Co. API is running',
                         'data': {'status': 'ok' if db == 'ok' else 'degraded', 'database': db}})


@extend_schema(tags=['Settings'], summary='Shop profile (singleton)')
class ShopProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ok(ShopProfileSerializer(ShopProfile.load()).data, 'Shop settings')

    def patch(self, request):
        if not request.user.is_owner:
            return Response({'success': False, 'message': 'Only the business owner can change settings.'},
                            status=403)
        profile = ShopProfile.load()
        serializer = ShopProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(ShopProfileSerializer(profile).data, 'Settings saved')


@extend_schema(tags=['Settings'], summary='Poster categories')
class CategoryViewSet(ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    http_method_names = ['get', 'post', 'patch', 'delete', 'head']
    queryset = Category.objects.all()

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsOwner()]

    def list(self, request, *args, **kwargs):
        return ok(CategorySerializer(self.get_queryset(), many=True).data, 'Categories')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return created(serializer.data, 'Category created')

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(serializer.data, 'Category updated')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.designs.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'category': 'This category has designs and cannot be deleted.'})
        instance.delete()
        return ok(None, 'Category deleted')


@extend_schema(tags=['Settings'], summary='Combo discount rules')
class DiscountRuleViewSet(ModelViewSet):
    serializer_class = DiscountRuleSerializer
    pagination_class = None
    queryset = DiscountRule.objects.all().order_by('min_qty')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsOwner()]

    def list(self, request, *args, **kwargs):
        return ok(DiscountRuleSerializer(self.get_queryset(), many=True).data, 'Discount rules')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return created(serializer.data, 'Rule created')

    def partial_update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(serializer.data, 'Rule updated')

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return ok(None, 'Rule deleted')


@extend_schema(tags=['Backup'], summary='Export full backup (JSON, frontend-compatible)')
class BackupExportView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        from django.http import JsonResponse
        return JsonResponse(dump_state(), safe=True)


@extend_schema(tags=['Backup'], summary='Restore backup (JSON). Replaces ALL business data.')
class BackupImportView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        try:
            stats = restore_state(request.data)
        except ValueError as exc:
            return Response({'success': False, 'message': str(exc)}, status=400)
        except Exception as exc:
            return Response({'success': False, 'message': f'Restore failed: {exc}'}, status=400)
        return ok(stats, 'Backup restored')


@extend_schema(tags=['Demo'], summary='Reset demo data (DEMO_MODE only, owner only)')
class DemoResetView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        from django.conf import settings
        if not settings.DEMO_MODE:
            return Response({'success': False, 'message': 'Demo reset is disabled (DEMO_MODE=False).'},
                            status=403)
        from core.demo_seed import seed
        stats = seed()
        return ok(stats, 'Demo data reset')
