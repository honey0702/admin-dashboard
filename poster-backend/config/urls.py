"""Rang Poster Co. — API root. All app URLs mount directly under /api/."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include([
        path('auth/', include('accounts.urls')),       # /api/auth/login/ …
        path('', include('inventory.urls')),            # /api/designs/ …
        path('', include('sales.urls')),                # /api/sales/ …
        path('', include('expenses.urls')),             # /api/expenses/, /api/expense-categories/
        path('', include('delivery.urls')),             # /api/orders/ …, /api/orders/waiting-radar/
        path('dashboard/', include('dashboard.urls')),  # /api/dashboard/overview/
        path('reports/', include('reports.urls')),      # /api/reports/daily/ …
        path('', include('core.urls')),                 # /api/health/, /api/settings/, /api/categories/ …
    ])),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
