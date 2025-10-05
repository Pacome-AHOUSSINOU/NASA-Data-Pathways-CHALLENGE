Urban Platform (no GDAL) - Django skeleton
=========================================

This project is a ready-to-edit Django backend for the GIBS Urban Platform without GDAL/PostGIS.

Features:
- Django project with apps: users, data, visualization, reports, dashboard
- Django REST Framework endpoints
- Simple services to fetch NASA GIBS tiles (HTTP only)
- Celery task example for report generation (optional)
- PostgreSQL (no PostGIS) ready configuration via env vars

Setup (local):
1. Create virtualenv and install dependencies:
   python -m venv venv
   source venv/bin/activate   # or venv\Scripts\activate on Windows
   pip install -r requirements.txt

2. Configure environment variables in a .env file (see .env.example).

3. Run migrations and start server:
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver

Notes:
- This skeleton purposefully avoids GDAL and GeoDjango to reduce native dependencies.
- For map visualization use Leaflet on the frontend and the /api/data/gibs-preview/ endpoint to proxy images if needed.
