"""Optional activation bridge for an explicitly launcher-managed local relay.

No subprocesses, database writes, or remote activation are allowed in this module.
"""
import json
import os
from urllib.parse import urlsplit
from urllib.request import Request,urlopen
from django.conf import settings


def ensure_local_relay():
    if not settings.DEBUG:return True
    url=os.environ.get('WORTIFY_LOCAL_REALTIME_CONTROL','')
    if not url:return True  # Production/manual relay configuration is unchanged.
    key=os.environ.get('WORTIFY_LOCAL_REALTIME_CONTROL_KEY','')
    try:
        parsed=urlsplit(url)
        if parsed.scheme!='http' or parsed.hostname!='127.0.0.1' or not parsed.port or parsed.path!='/activate' or parsed.query or parsed.fragment or parsed.username or len(key)<32:
            return False
        request=Request(url,data=b'{}',headers={'X-Wortify-Local-Key':key,'Content-Type':'application/json'},method='POST')
        with urlopen(request,timeout=1) as response:
            return json.load(response).get('state') in ('ready','starting')
    except Exception:return False
