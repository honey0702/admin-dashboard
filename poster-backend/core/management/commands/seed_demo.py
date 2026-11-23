from django.core.management.base import BaseCommand

from core.demo_seed import seed


class Command(BaseCommand):
    help = 'Wipe business data and load the deterministic Rang Poster Co. demo dataset.'

    def handle(self, *args, **options):
        stats = seed()
        self.stdout.write(self.style.SUCCESS(
            f"Seeded {stats['designs']} designs, {stats['sales']} sales, "
            f"{stats['expenses']} expenses, {stats['orders']} orders (owner: {stats['owner']})"
        ))
