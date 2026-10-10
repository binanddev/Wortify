def ordered(queryset, raw, allowed, default):
    if not raw: return queryset.order_by(*default)
    keys=raw.split(',')
    if len(keys)>8 or len(set(k.lstrip('-') for k in keys))!=len(keys):raise ValueError('Invalid sort columns.')
    fields=[]
    for key in keys:
        name=key.lstrip('-')
        if name not in allowed:raise ValueError('Invalid sort column.')
        fields.append(('-' if key.startswith('-') else '')+allowed[name])
    return queryset.order_by(*fields,'pk')
