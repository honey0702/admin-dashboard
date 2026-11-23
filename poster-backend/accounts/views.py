from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.utils import extend_schema

from core.responses import ok
from .models import User
from .permissions import IsOwner
from .serializers import ChangePasswordSerializer, RegisterSerializer, UserSerializer


@extend_schema(tags=['Auth'], summary='Login (JWT)', request={'application/json': {'type': 'object', 'properties': {'username': {'type': 'string'}, 'password': {'type': 'string'}}, 'required': ['username', 'password']}})
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        from rest_framework.response import Response
        username = (request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        user = authenticate(username=username, password=password)
        if user is None:
            return Response({'success': False, 'message': 'Invalid username or password'}, status=401)
        refresh = RefreshToken.for_user(user)
        return ok({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, 'Signed in successfully')


@extend_schema(tags=['Auth'], summary='Logout (blacklist refresh token)')
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data or {}).get('refresh')
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:
                pass  # already blacklisted/invalid — logout is idempotent
        return ok(None, 'Signed out')


@extend_schema(tags=['Auth'], summary='Refresh access token')
class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            return ok(response.data, 'Token refreshed')
        return response


@extend_schema(tags=['Auth'], summary='Current user profile', responses={200: UserSerializer})
class MeView(RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        response = super().update(request, *args, **kwargs)
        response.data = {'success': True, 'message': 'Profile updated', 'data': response.data}
        return response

    def retrieve(self, request, *args, **kwargs):
        return ok(UserSerializer(self.get_object()).data, 'Profile')


@extend_schema(tags=['Auth'], summary='Change password', request=ChangePasswordSerializer)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save(update_fields=['password'])
        return ok(None, 'Password changed')


@extend_schema(tags=['Auth'], summary='Register a staff/owner account (owner only)', request=RegisterSerializer, responses={201: UserSerializer})
class RegisterView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return ok(UserSerializer(user).data, 'Account created', status=201)
