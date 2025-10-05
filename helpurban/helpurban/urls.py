from django.contrib import admin
from django.urls import path, include
from .views import CitiesAPIView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('data.urls')),
    path('api/cities/', CitiesAPIView.as_view(), name='cities-api'),
]
