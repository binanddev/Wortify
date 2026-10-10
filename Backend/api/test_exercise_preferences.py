from django.test import SimpleTestCase
from users.preferences import validate_preferences
class ExercisePreferencesTests(SimpleTestCase):
    def test_valid_and_invalid_typography(self):
        values={'exerciseTextSize':28,'exerciseTextWeight':600}
        self.assertEqual(validate_preferences(values),values)
        for values in ({'exerciseTextSize':15},{'exerciseTextSize':37},{'exerciseTextWeight':701},{'exerciseTextWeight':True}):
            with self.assertRaises(ValueError): validate_preferences(values)
