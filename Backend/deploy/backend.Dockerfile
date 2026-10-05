FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app
WORKDIR /app
COPY requirements.txt requirements-production.txt requirements-production.lock ./
RUN pip install --no-cache-dir -r requirements-production.txt
RUN groupadd --gid 10001 wortify && useradd --uid 10001 --gid wortify --no-create-home wortify
COPY . ./
RUN mkdir -p /app/private_media /app/staticfiles && chown -R wortify:wortify /app
USER wortify
EXPOSE 8000
CMD ["sh", "-c", "python manage.py collectstatic --noinput && exec gunicorn --config deploy/gunicorn.conf.py config.wsgi:application"]
