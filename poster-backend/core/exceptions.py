"""Consistent JSON error envelope for the whole API.

Success responses are built with core.responses.ok(); this handler converts
any raised APIException (including DRF validation errors) into:

    {"success": false, "message": "...", "errors": {...}}
"""
import logging

from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger('rang_poster')


def envelope_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Unhandled exception — log the traceback, return a clean 500 envelope.
        logger.exception('Unhandled API exception', exc_info=exc)
        return Response({'success': False, 'message': 'Internal server error'}, status=500)

    data = response.data
    if isinstance(data, dict) and 'success' in data:
        return response

    message = 'Request failed'
    errors = None
    if isinstance(data, dict):
        non_field = data.get('non_field_errors') or data.get('detail')
        if isinstance(non_field, list):
            message = str(non_field[0])
        elif non_field:
            message = str(non_field)
        field_errors = {k: v for k, v in data.items() if k not in ('non_field_errors', 'detail')}
        if field_errors:
            errors = field_errors
            if message == 'Request failed':
                first_key = next(iter(field_errors))
                first_val = field_errors[first_key]
                first_msg = first_val[0] if isinstance(first_val, list) and first_val else first_val
                message = f'{first_key}: {first_msg}' if first_msg else f'Invalid {first_key}'
    elif isinstance(data, list):
        message = str(data[0]) if data else message
        errors = {'errors': data}

    payload = {'success': False, 'message': message}
    if errors:
        payload['errors'] = errors
    response.data = payload
    return response
