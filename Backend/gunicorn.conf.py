import os

bind = '0.0.0.0:' + os.environ.get('PORT', '8000')
workers = int(os.environ.get('WEB_CONCURRENCY', '1'))
worker_class = 'gthread'
threads = int(os.environ.get('WEB_THREADS', '4'))
timeout = 120
accesslog = '-'
errorlog = '-'
access_log_format = '%(t)s %(m)s %(U)s %(s)s %(L)s'
forwarded_allow_ips = '*' if os.environ.get('RENDER') else '127.0.0.1'
