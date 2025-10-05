from rest_framework import serializers
from .models import Dataset, AreaOfInterest

class DatasetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = '__all__'

class AOISerializer(serializers.ModelSerializer):
    class Meta:
        model = AreaOfInterest
        fields = '__all__'
