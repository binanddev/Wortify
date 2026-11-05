import json
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase, Client
from django.utils import timezone
from users.preferences import validate_preferences


class InterfacePreferenceValidationTests(SimpleTestCase):
    def test_interface_modes_are_whitelisted(self):
        for mode in ('studio','glass','xp','retro','notebook','rpg'):
            self.assertEqual(validate_preferences({'interface':mode}), {'interface':mode})
        self.assertEqual(validate_preferences({'interface':'space'}), {'interface':'studio'})
        with self.assertRaises(ValueError):
            validate_preferences({'interface':'unknown'})

    def test_retired_aurora_preferences_can_sync(self):
        profiles = {'default:aurora:mist': {'font': 36}}
        self.assertEqual(validate_preferences({'appearanceProfiles': profiles})['appearanceProfiles'], profiles)
        self.assertEqual(validate_preferences({'interface': 'aurora'}), {'interface': 'studio'})

    def test_scale_bounds_and_all_builtin_tracks(self):
        for scale in (50, 100, 150):
            self.assertEqual(validate_preferences({'navScale':scale}), {'navScale':scale})
        for track in ('morning','marimba','picnic','bubbles','cafe','garden','puzzle','clouds','starlight','steps'):
            self.assertEqual(validate_preferences({'ambientTrack':track}), {'ambientTrack':track})
        for invalid in ({'navScale':49}, {'navScale':151}, {'navScale':True}, {'ambientTrack':'https://example.com/audio.mp3'}, {'ambientTrack':None}):
            with self.assertRaises(ValueError):
                validate_preferences(invalid)


    def test_studio_colors_are_safe_and_supported_in_profiles(self):
        colors={'studioPageColor':'#f5faf6','studioNavColor':'#abcdef','studioAccentColor':'auto'}
        self.assertEqual(validate_preferences(colors),colors)
        self.assertEqual(validate_preferences({'appearanceProfiles':{'default:studio:mist':colors}})['appearanceProfiles']['default:studio:mist'],colors)
        for key in colors:
            for value in ('red','url(https://example.com)', '#123', '#ffffff00', None, True, {}):
                with self.subTest(key=key,value=value), self.assertRaises(ValueError):
                    validate_preferences({key:value})



class InterfacePreferenceSyncTests(TestCase):
    def test_preferences_persist_for_another_login_without_touching_other_settings(self):
        user = get_user_model().objects.create_user('interface-user')
        self.client.force_login(user)
        values = {'studioPageColor':'#eeeaff','studioNavColor':'#15264a','studioAccentColor':'#674ac4','appearanceSelections':{'default':{'interface':'glass','background':'night'}}, 'appearanceProfiles':{'default:studio:mist':{'textColor':'#ffffff','navScale':75},'default:glass:mist':{'textColor':'#000000'}}, 'interface':'glass', 'navScale':50, 'ambientTrack':'marimba', 'ambient':True, 'volume':0.2}
        response = self.client.post('/api/en/learning/sync/', json.dumps({'events':[
            {'token':str(uuid.uuid4()), 'kind':'preferences', 'at':timezone.now().isoformat(), 'payload':values}
        ]}), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['errors'], [])
        other = Client()
        other.force_login(user)
        self.assertEqual(other.get('/api/session/').json()['user']['preferences'], values)

    def test_saved_theme_endpoint_is_retired(self):
        user = get_user_model().objects.create_user('retired-theme-user')
        self.client.force_login(user)
        response = self.client.post('/api/themes/', {'name':'Preset','preferences':'{}'})
        self.assertEqual(response.status_code,410)

class ExtendedThemePreferencesTests(TestCase):
    def test_new_modes_and_recordings_survive_account_sync(self):
        user=get_user_model().objects.create_user('new-themes-user')
        self.client.force_login(user)
        for mode in ('xp','retro','notebook','rpg'):
            payload={'interface':mode,'ambientTrack':'hearth','appearanceProfiles':{f'default:{mode}:mist':{'textSize':20}}}
            response=self.client.post('/api/en/learning/sync/',json.dumps({'events':[{'token':str(uuid.uuid4()),'kind':'preferences','at':timezone.now().isoformat(),'payload':payload}]}),content_type='application/json')
            self.assertEqual(response.json()['errors'],[])
            self.assertEqual(self.client.get('/api/session/').json()['user']['preferences']['interface'],mode)
    def test_new_account_has_no_nonstudio_interface_override(self):
        user=get_user_model().objects.create_user('default-studio-user')
        self.client.force_login(user)
        prefs=self.client.get('/api/session/').json()['user']['preferences']
        self.assertEqual(prefs.get('interface','studio'),'studio')
