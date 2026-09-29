import os
bind = '0.0.0.0:8000'
workers = int(os.environ.get('WEB_CONCURRENCY', '2'))
worker_class = 'gthread'
threads = int(os.environ.get('WEB_THREADS', '4'))
timeout = 180
graceful_timeout = 30
keepalive = 5
accesslog = '-'
errorlog = '-'
access_log_format = '%(t)s %(m)s %(U)s %(s)s %(L)s'
# Backend is isolated; Django trusts only the proxy-set X-Forwarded-Proto.
forwarded_allow_ips = os.environ.get('FORWARDED_ALLOW_IPS', '127.0.0.1')
