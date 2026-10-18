"""Enforce visibility for ordinary saves, imports and bulk administrative writes."""
from contextlib import contextmanager
from django.db import models, transaction

@contextmanager
def sharing_mode(using='default'):
    from .models import ContentPolicy
    with transaction.atomic(using=using):
        policy, _ = ContentPolicy.objects.using(using).get_or_create(pk=1)
        policy = ContentPolicy.objects.using(using).select_for_update().get(pk=policy.pk)
        yield policy.mode

class SharedContentQuerySet(models.QuerySet):
    def update(self, **kwargs):
        if 'visibility' not in kwargs:
            return super().update(**kwargs)
        with sharing_mode(self.db) as mode:
            if mode == 'public':
                kwargs['visibility'] = 'public'
            return super().update(**kwargs)

    def bulk_create(self, objs, *args, **kwargs):
        objs = list(objs)
        with sharing_mode(self.db) as mode:
            if mode == 'public':
                for obj in objs:
                    obj.visibility = 'public'
            return super().bulk_create(objs, *args, **kwargs)

class SharedContent(models.Model):
    objects = SharedContentQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        using = kwargs.get('using') or self._state.db or 'default'
        with sharing_mode(using) as mode:
            if mode == 'public':
                self.visibility = 'public'
                if kwargs.get('update_fields') is not None:
                    kwargs['update_fields'] = set(kwargs['update_fields']) | {'visibility'}
            return super().save(*args, **kwargs)
