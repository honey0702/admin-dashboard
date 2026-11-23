from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('designs', views.DesignViewSet, basename='design')

urlpatterns = [
    path('designs/low-stock/', views.LowStockView.as_view(), name='low-stock'),
    path('designs/out-of-stock/', views.OutOfStockView.as_view(), name='out-of-stock'),
    path('', include(router.urls)),
]
