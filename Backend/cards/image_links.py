"""Only remote image links and attribution text are stored, never image bytes."""
import ipaddress
from urllib.parse import urlsplit
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

IMAGE_FIELDS={'image_url':2000,'image_source_url':2000,'image_credit':500,'image_license':100,'image_license_url':2000}

def validate_image_fields(data):
    for field,limit in IMAGE_FIELDS.items():
        value=data.get(field,'')
        if not isinstance(value,str) or len(value)>limit: raise ValidationError('Invalid image field: '+field)
        if field.endswith('url') and value:
            URLValidator(schemes=['https'])(value)
            parsed=urlsplit(value);host=(parsed.hostname or '').lower()
            if parsed.username or parsed.password or host in ('localhost','localhost.localdomain') or host.endswith(('.localhost','.local','.internal')):
                raise ValidationError('Use a public HTTPS image link.')
            try:
                address=ipaddress.ip_address(host)
            except ValueError:
                address=None
            if address and not address.is_global: raise ValidationError('Use a public HTTPS image link.')
    return data
