from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('orders', views.OrderViewSet, basename='order')

urlpatterns = [
    path('orders/waiting-radar/', views.WaitingRadarView.as_view(), name='waiting-radar'),
    path('', include(router.urls)),
]
