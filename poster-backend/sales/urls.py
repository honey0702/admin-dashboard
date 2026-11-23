from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('sales', views.SaleViewSet, basename='sale')

urlpatterns = [
    path('sales/summary/', views.SalesSummaryView.as_view(), name='sales-summary'),
    path('', include(router.urls)),
]
