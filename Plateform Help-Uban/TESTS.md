Manual tests:
- pip install -r requirements.txt
- create .env with env values (or set env vars)
- python manage.py migrate
- python manage.py createsuperuser
- python manage.py runserver
- Visit http://127.0.0.1:8000/ and try the GIBS preview link
- POST to /api/reports/generate/ with JSON {title, text} to queue a report task (requires celery worker)
