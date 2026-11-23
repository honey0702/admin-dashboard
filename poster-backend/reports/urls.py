from django.urls import path
from . import views

urlpatterns = [
    path('daily/', views.DailyReportView.as_view(), name='reports-daily'),
    path('daily/export/', views.DailyReportCSVView.as_view(), name='reports-daily-csv'),
    path('monthly/', views.MonthlyReportView.as_view(), name='reports-monthly'),
    path('summary/', views.SummaryView.as_view(), name='reports-summary'),
]
