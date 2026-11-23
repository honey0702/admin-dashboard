from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.responses import ok
from . import services


@extend_schema(tags=['Dashboard'], summary='Overview statistics (real, DB-computed)',
               parameters=[
                   OpenApiParameter('range', str, description='7d | 14d | 30d | 90d | all (default 30d)'),
                   OpenApiParameter('from', str, description='YYYY-MM-DD (with to) — custom window'),
                   OpenApiParameter('to', str, description='YYYY-MM-DD (with from) — custom window'),
               ])
class OverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return ok(services.overview(request.query_params), 'Overview')
