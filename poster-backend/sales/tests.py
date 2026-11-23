from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from accounts.models import User
from core.models import Category, StockMovement
from inventory.models import Design
from sales.models import Sale


class SalesWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='testowner', password='Strong-pass-123')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        category = Category.objects.create(name='Art')
        self.design = Design.objects.create(code='D001', name='Poster', category=category,
                                            price=Decimal('60'), quantity=5, avg_cost=Decimal('12'))

    def test_price_snapshot_stock_cancel_and_audit(self):
        response = self.client.post('/api/sales/', {'lines': [{'design_code':'D001', 'qty': 2,
                                      'unit_price': '1'}], 'payment': 'Cash'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        data = response.data['data']
        self.assertEqual(Decimal(data['total']), Decimal('120'))
        item = Sale.objects.get(number=data['id']).items.get()
        self.assertEqual(item.unit_cost, Decimal('12'))
        self.design.refresh_from_db()
        self.assertEqual(self.design.quantity, 3)
        self.design.price = Decimal('100')
        self.design.save()
        item.refresh_from_db()
        self.assertEqual(item.unit_price, Decimal('60'))
        response = self.client.post(f"/api/sales/{data['id']}/cancel/", {'reason': 'Returned'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.design.refresh_from_db()
        self.assertEqual(self.design.quantity, 5)
        self.assertEqual(StockMovement.objects.filter(design=self.design).count(), 2)
        self.assertEqual(Sale.objects.get(number=data['id']).status, 'cancelled')

    def test_oversell_is_atomic(self):
        response = self.client.post('/api/sales/', {'lines':[{'design_code':'D001','qty':6}],
                                                    'payment':'Cash'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.design.refresh_from_db()
        self.assertEqual(self.design.quantity, 5)
        self.assertEqual(Sale.objects.count(), 0)

    def test_private_endpoints_require_login(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/designs/').status_code, 401)
