import json, sys
import urllib.request, urllib.error

BASE = 'http://localhost:8000/api'
fails = []

def call(method, path, body=None, token=None, raw=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={'Content-Type': 'application/json', 'Accept': 'application/json',
                 **({'Authorization': f'Bearer {token}'} if token else {})})
    try:
        with urllib.request.urlopen(req) as res:
            payload = res.read()
            return res.status, (payload if raw else json.loads(payload or b'null'))
    except urllib.error.HTTPError as e:
        payload = e.read()
        try:
            return e.code, json.loads(payload or b'null')
        except Exception:
            return e.code, payload

def check(name, cond, detail=''):
    status = 'PASS' if cond else 'FAIL'
    if not cond:
        fails.append(f'{name}: {detail}')
    print(f'[{status}] {name} {detail if not cond else ""}')

# 1. health (public)
s, b = call('GET', '/health/')
check('health public', s == 200 and b['success'] and b['data']['database'] == 'ok', f'{s} {b}')

# 2. auth required
s, b = call('GET', '/designs/')
check('designs requires auth', s == 401, f'{s}')

# 3. login (bad + good)
s, b = call('POST', '/auth/login/', {'username': 'aarav', 'password': 'wrong'})
check('login rejects bad credentials', s == 401 and b['success'] is False, f'{s} {b}')
s, b = call('POST', '/auth/login/', {'username': 'aarav', 'password': 'Owner@123'})
check('login succeeds', s == 200 and b['success'] and b['data'].get('access'), f'{s} {json.dumps(b)[:120]}')
token = b['data']['access']
refresh = b['data']['refresh']

# 4. me
s, b = call('GET', '/auth/me/', token=token)
check('me', s == 200 and b['data']['username'] == 'aarav' and b['data']['is_owner'], f'{s} {b}')

# 5. designs list
s, b = call('GET', '/designs/', token=token)
check('designs list', s == 200 and b['success'] and len(b['data']) == 28, f'{s} count={len(b.get("data", []))}')
d001 = next(d for d in b['data'] if d['id'] == 'D001')
q_before = d001['quantity']
price = d001['price']

# 6. low stock + out of stock + stats
s, b = call('GET', '/designs/low-stock/', token=token)
check('low-stock list', s == 200 and all(0 < d['quantity'] <= d['min_stock'] for d in b['data']), f'{s}')
s, b = call('GET', '/designs/stats/', token=token)
check('inventory stats', s == 200 and b['data']['total_copies'] > 0, f'{s} {b.get("data")}')

# 7. create sale (auto combo discount: 3 posters of D001 → expect ₹40)
s, b = call('POST', '/sales/', {'lines': [{'design_code': 'D001', 'qty': 3}], 'payment': 'UPI'}, token=token)
check('sale created', s == 201 and b['success'], f'{s} {json.dumps(b)[:200]}')
sale = b.get('data', {})
check('combo discount applied (3→40)', float(sale.get('discount', -1)) == 40.0, f"discount={sale.get('discount')}")
check('backend-computed total', float(sale.get('total', -1)) == 3 * float(price) - 40, f"total={sale.get('total')}")
check('customer id format', str(sale.get('id', '')).startswith('S-'), f"id={sale.get('id')}")
sale_number = sale['id']
cogs = float(sale.get('cogs', 0))
check('cogs snapshot present', cogs > 0, f'cogs={cogs}')

# 8. stock decremented
s, b = call('GET', f'/designs/D001/', token=token)
check('stock decremented by 3', b['data']['quantity'] == q_before - 3, f"before={q_before} after={b['data']['quantity']}")

# 9. insufficient stock rejected atomically
s, b = call('POST', '/sales/', {'lines': [{'design_code': 'D004', 'qty': 999}], 'payment': 'Cash'}, token=token)
check('overselling rejected', s == 400 and b['success'] is False, f'{s} {b}')
s, b = call('GET', f'/designs/D004/', token=token)
check('stock unchanged after failed sale', b['data']['quantity'] == 0, f"D004 qty={b['data']['quantity']}")

# 10. discount capped at gross
s, b = call('POST', '/sales/', {'lines': [{'design_code': 'D002', 'qty': 1}], 'payment': 'Cash', 'discount': 9999}, token=token)
check('discount clamped to gross', s == 201 and isinstance(b.get('data'), dict) and float(b['data']['total']) == 0.0, f'{s} total={b.get("data", {}).get("total") if isinstance(b.get("data"), dict) else b}')
clamped_id = b['data']['id'] if isinstance(b.get('data'), dict) else None

# 11. cancel sale restores stock
s, b = call('POST', f'/sales/{sale_number}/cancel/', {'reason': 'Customer changed mind'}, token=token)
check('sale cancelled', s == 200 and b['data']['status'] == 'cancelled', f'{s} {b}')
s, b = call('GET', '/designs/D001/', token=token)
check('stock restored after cancel', b['data']['quantity'] == q_before, f"restored qty={b['data']['quantity']}")

# 12. expenses list + stats
s, b = call('GET', '/expenses/', token=token)
check('expenses list', s == 200 and len(b['data']) == 21, f'{s} count={len(b.get("data", []))}')
s, b = call('POST', '/expenses/', {'title': 'Smoke test expense', 'category': 'Miscellaneous', 'amount': '42.50', 'mode': 'Cash', 'kind': 'one-time', 'date': '2026-11-23T10:00:00+05:30'}, token=token)
check('expense create', s == 201 and b['success'], f'{s} {json.dumps(b)[:150]}')
exp_id = b['data']['id']
s, b = call('PATCH', f'/expenses/{exp_id}/', {'amount': '45.00'}, token=token)
check('expense update', s == 200 and b['data']['amount'] == '45.00', f'{s} {b.get("data", {}).get("amount") if isinstance(b.get("data"), dict) else b}')
s, b = call('DELETE', f'/expenses/{exp_id}/', token=token)
check('expense delete', s == 200 and b['success'], f'{s}')

# 13. orders
s, b = call('GET', '/orders/', token=token)
check('orders list', s == 200 and len(b['data']) == 8, f'{s} count={len(b.get("data", []))}')
s, b = call('POST', '/orders/', {'customer': {'name': 'Smoke Tester', 'phone': '90000 00000', 'pin': '395001'}, 'items': [{'design_code': 'D001', 'qty': 1}], 'method': 'Home Delivery', 'payment_mode': 'UPI', 'payment_amount': '60', 'payment_status': 'unpaid'}, token=token)
check('order create', s == 201 and b['success'], f'{s} {json.dumps(b)[:200]}')
order_no = b['data']['id'] if isinstance(b.get('data'), dict) else None
s, b = call('POST', f'/orders/{order_no}/fulfill/', {}, token=token)
check('order fulfill creates sale', s == 200 and b['data'].get('linked_sale'), f'{s} {json.dumps(b)[:200]}')
s, b = call('POST', f'/orders/{order_no}/fulfill/', {}, token=token)
check('fulfill is idempotent', s == 200 and b['message'].startswith('Already'), f'{s} {b.get("message")}')

# 14. dashboard + reports
s, b = call('GET', '/dashboard/overview/?range=30d', token=token)
check('dashboard overview', s == 200 and b['data']['posters_sold'] > 0 and len(b['data']['series']) == 30, f'{s} posters={b.get("data", {}).get("posters_sold")}')
print('      revenue(30d) =', b['data']['revenue'], '| net profit =', b['data']['net_profit'], '| month break-even pct =', b['data']['break_even']['pct'])
s, b = call('GET', '/reports/daily/', token=token)
check('daily closing', s == 200 and b['success'] and 'net_collected' in b['data'], f'{s}')
s, b = call('GET', '/reports/summary/?from=2026-11-01&to=2026-11-23', token=token)
check('summary window', s == 200 and b['data']['posters_sold'] >= 0, f'{s}')
s, b = call('GET', '/reports/daily/export/', token=token, raw=True)
check('daily CSV export', s == 200 and b'Daily closing' in b, f'{s}')

# 15. backup round trip
s, b = call('GET', '/backup/export/', token=token, raw=True)
check('backup export', s == 200 and b'"designs"' in b and b'"sales"' in b, f'{s}')
exported = json.loads(b)
check('backup shape is frontend-compatible', 'version' in exported and exported['version'] == 1 and 'designs' in exported, '')

# 16. waiting radar
s, b = call('GET', '/orders/waiting-radar/', token=token)
check('waiting radar', s == 200 and len(b['data']) >= 2, f'{s} orders={len(b.get("data", []))}')

# 17. refresh flow
s, b = call('POST', '/auth/refresh/', {'refresh': refresh})
check('refresh token works', s == 200 and ('access' in b.get('data', {}) or 'access' in b), f'{s}')

print()
if fails:
    print('FAILURES:', len(fails))
    for f in fails: print(' -', f)
    sys.exit(1)
print('ALL API SMOKE CHECKS PASSED')
