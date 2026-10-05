import json
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, Client
from django.utils import timezone
from users.preferences import validate_preferences


class InterfacePreferenceValidationTests(SimpleTestCase):
    def test_interface_modes_are_whitelisted(self):
        for mode in ('studio','glass'):
            self.assertEqual(validate_preferences({'interface':mode}), {'interface':mode})
        with self.assertRaises(ValueError):
            validate_preferences({'interface':'unknown'})

    def test_scale_bounds_and_all_builtin_tracks(self):
        for scale in (50, 100, 150):
            self.assertEqual(validate_preferences({'navScale':scale}), {'navScale':scale})
        for track in ('morning','marimba','picnic','bubbles','cafe','garden','puzzle','clouds','starlight','steps'):
            self.assertEqual(validate_preferences({'ambientTrack':track}), {'ambientTrack':track})
        for invalid in ({'navScale':49}, {'navScale':151}, {'navScale':True}, {'ambientTrack':'https://example.com/audio.mp3'}, {'ambientTrack':None}):
            with self.assertRaises(ValueError):
                validate_preferences(invalid)


class InterfacePreferenceSyncTests(TestCase):
    def test_preferences_persist_for_another_login_without_touching_other_settings(self):
        user = get_user_model().objects.create_user('interface-user')
        self.client.force_login(user)
        values = {'appearanceSelections':{'default':{'interface':'glass','background':'night'}}, 'appearanceProfiles':{'default:studio:mist':{'textColor':'#ffffff','navScale':75},'default:glass:mist':{'textColor':'#000000'}}, 'interface':'glass', 'navScale':50, 'ambientTrack':'marimba', 'ambient':True, 'volume':0.2}
        response = self.client.post('/api/en/learning/sync/', json.dumps({'events':[
            {'token':str(uuid.uuid4()), 'kind':'preferences', 'at':timezone.now().isoformat(), 'payload':values}
        ]}), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['errors'], [])
        other = Client()
        other.force_login(user)
        self.assertEqual(other.get('/api/session/').json()['user']['preferences'], values)

    def test_saved_themes_preserve_the_selected_interface(self):
        user = get_user_model().objects.create_user('theme-interface-user')
        self.client.force_login(user)
        for preferences, expected in (({}, 'studio'), ({'interface':'glass'}, 'glass')):
            response = self.client.post('/api/themes/', {'name':expected, 'preferences':json.dumps(preferences)})
            self.assertEqual(response.status_code, 201, response.content)
        themes = self.client.get('/api/themes/').json()['themes']
        self.assertEqual({theme['name']:theme['preferences']['interface'] for theme in themes}, {'studio':'studio','glass':'glass'})
