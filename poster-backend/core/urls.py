from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('categories', views.CategoryViewSet, basename='category')
router.register('discount-rules', views.DiscountRuleViewSet, basename='discount-rule')

urlpatterns = [
    path('health/', views.HealthView.as_view(), name='health'),
    path('settings/', views.ShopProfileView.as_view(), name='settings'),
    path('backup/export/', views.BackupExportView.as_view(), name='backup-export'),
    path('backup/import/', views.BackupImportView.as_view(), name='backup-import'),
    path('demo/reset/', views.DemoResetView.as_view(), name='demo-reset'),
    path('', include(router.urls)),
]
