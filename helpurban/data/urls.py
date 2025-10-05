# data/urls.py
from django.urls import path
from .views import visualization_view

urlpatterns = [
    path('', visualization_view, name="visualization"),
]
