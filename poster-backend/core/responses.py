"""Helpers for the standard success envelope: {"success": true, "message", "data"}."""
from rest_framework.response import Response


def ok(data=None, message='OK', status=200):
    return Response({'success': True, 'message': message, 'data': data}, status=status)


def created(data=None, message='Created'):
    return ok(data, message, status=201)
