import os
from celery import Celery
from decouple import config

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
app = Celery('core', broker=config('CELERY_BROKER_URL', default='redis://localhost:6379/0'))
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
