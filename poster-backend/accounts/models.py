from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLES = [('owner', 'Owner'), ('staff', 'Staff')]
    role = models.CharField(max_length=12, choices=ROLES, default='owner')
    phone = models.CharField(max_length=20, blank=True)

    @property
    def is_owner(self):
        return self.role == 'owner' or self.is_superuser

    def __str__(self):
        return self.get_full_name() or self.username
