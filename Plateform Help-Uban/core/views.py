from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.http import HttpResponse
from django.conf import settings
from django.views import View
import csv
import os

class CitiesAPIView(View):
    def get(self, request):
        # Chemin vers votre fichier CSV
        csv_path = os.path.join(settings.BASE_DIR, 'worldcities.csv')
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                csv_data = f.read()
            
            response = HttpResponse(csv_data, content_type='text/csv')
            response['Content-Disposition'] = 'inline; filename="cities.csv"'
            return response
        except FileNotFoundError:
            return HttpResponse('Fichier CSV non trouvé', status=404)

def visualization_view(request):
    return render(request, 'visualization.html')