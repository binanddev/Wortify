from django.test.runner import DiscoverRunner

class PlatformRunner(DiscoverRunner):
    """The Django applications live below backend/, outside the root discovery path."""
    def build_suite(self, test_labels=None, **kwargs):
        return super().build_suite(test_labels or ['api', 'cards'], **kwargs)
