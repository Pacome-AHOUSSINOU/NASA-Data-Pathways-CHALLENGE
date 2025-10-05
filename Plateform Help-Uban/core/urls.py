from django.contrib import admin
from django.urls import path, include
from core.views import CitiesAPIView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/data/', include('data.urls')),
    path('api/cities/', CitiesAPIView.as_view(), name='cities-api'),
]
