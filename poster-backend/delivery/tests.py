from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from core.models import Category
from inventory.models import Design
from sales.models import Sale


class DeliveryWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='owner', password='Strong-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.design = Design.objects.create(code='D001', name='Poster',
            category=Category.objects.create(name='Art'), price=Decimal('60'), quantity=2)

    def create_order(self):
        response = self.client.post('/api/orders/', {'customer': {'name':'Test','phone':'12345'},
            'items':[{'design_code':'D001','qty':1}], 'method':'Home Delivery',
            'payment_mode':'Cash','payment_amount':'0','payment_status':'unpaid'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data['data']['id']

    def test_pending_not_revenue_and_fulfillment_idempotent(self):
        order = self.create_order()
        self.assertEqual(Sale.objects.count(), 0)
        for _ in range(2):
            response = self.client.post(f'/api/orders/{order}/fulfill/', {}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Sale.objects.count(), 1)
        self.design.refresh_from_db()
        self.assertEqual(self.design.quantity, 1)

    def test_delivered_transition_records_sale(self):
        order = self.create_order()
        response = self.client.post(f'/api/orders/{order}/status/', {'status':'delivered'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Sale.objects.count(), 1)
