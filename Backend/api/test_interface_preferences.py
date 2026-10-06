import json
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, Client
from django.utils import timezone
from users.preferences import validate_preferences


class InterfacePreferenceValidationTests(SimpleTestCase):
    def test_interface_modes_are_whitelisted(self):
        for mode in ('studio','glass','xp','retro','space'):
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

class GlassThemePolicyTests(TestCase):
    def test_glass_theme_locks_display_and_clamps_transparency(self):
        user = get_user_model().objects.create_user('glass-policy-user')
        self.client.force_login(user)
        response = self.client.post('/api/themes/', {'name':'Glass locked', 'preferences':json.dumps({'interface':'glass','textColor':'#000000','textSize':22,'transparency':0})})
        self.assertEqual(response.status_code,201,response.content)
        prefs=self.client.get('/api/themes/').json()['themes'][0]['preferences']
        self.assertEqual(prefs['textColor'],'#ffffff')
        self.assertEqual(prefs['textSize'],18)
        self.assertEqual(prefs['transparency'],10)

class ExtendedThemePreferencesTests(TestCase):
    def test_new_modes_and_recordings_survive_account_sync(self):
        user=get_user_model().objects.create_user('new-themes-user')
        self.client.force_login(user)
        for mode in ('xp','retro','space'):
            payload={'interface':mode,'ambientTrack':'hearth','appearanceProfiles':{f'default:{mode}:mist':{'textSize':20}}}
            response=self.client.post('/api/en/learning/sync/',json.dumps({'events':[{'token':str(uuid.uuid4()),'kind':'preferences','at':timezone.now().isoformat(),'payload':payload}]}),content_type='application/json')
            self.assertEqual(response.json()['errors'],[])
            self.assertEqual(self.client.get('/api/session/').json()['user']['preferences']['interface'],mode)
    def test_new_account_has_no_nonstudio_interface_override(self):
        user=get_user_model().objects.create_user('default-studio-user')
        self.client.force_login(user)
        prefs=self.client.get('/api/session/').json()['user']['preferences']
        self.assertEqual(prefs.get('interface','studio'),'studio')
