def validate_preferences(data):
    numeric={'navScale':(50,150),'font':(24,60),'volume':(0,1),'transparency':(0,100),'textSize':(16,22),'textWeight':(400,700),'textContrast':(0,100),'curvature':(0,32),'glassLens':(0,100)}
    result={}
    for key,value in data.items():
        if key in numeric:
            lo,hi=numeric[key]
            if type(value) not in (int,float) or not lo<=value<=hi:raise ValueError('Invalid setting value: '+key)
        elif key in ('sound','ambient','navPinned'):
            if type(value) is not bool:raise ValueError('Invalid audio settings.')
        elif key=='ambientTrack':
            if value not in ('morning','marimba','picnic','bubbles','cafe','garden','puzzle','clouds','starlight','steps','bounce','ghost','begin','ukulele','island','tropical','sunshine','arcade','dew','hearth'):raise ValueError('Invalid background melody.')
        elif key=='appearanceSelections':
            if not isinstance(value,dict) or len(value)>300:raise ValueError('Invalid theme settings.')
            value = dict(value)
            for name, settings in value.items():
                if not isinstance(name,str) or (name!='default' and not name.isdecimal()):raise ValueError('Invalid theme.')
                if not isinstance(settings,dict) or set(settings)-{'interface','background'}:raise ValueError('Invalid theme parameters.')
                value[name] = validate_preferences(settings)
        elif key=='appearanceProfiles':
            import re
            allowed = {'navScale','font','transparency','textSize','textWeight','textContrast','textColor','curvature','glassLens'}
            if not isinstance(value,dict) or len(value)>300:raise ValueError('Invalid appearance settings.')
            for name, settings in value.items():
                if not isinstance(name,str) or not re.fullmatch(r'(default|[0-9]+):(studio|glass|xp|retro|space|notebook|rpg):(mist|paper|night)',name):raise ValueError('Invalid theme.')
                if not isinstance(settings,dict) or set(settings)-allowed:raise ValueError('Invalid appearance parameters.')
                validate_preferences(settings)
        elif key=='interface':
            if value == 'space': value = 'studio'
            if value not in ('studio','glass','xp','retro','space','notebook','rpg'):raise ValueError('Invalid appearance.')
        elif key=='textColor':
            import re
            if not isinstance(value,str) or (value != 'auto' and not re.fullmatch(r'#[0-9a-fA-F]{6}', value)):raise ValueError('Invalid text color.')
        elif key=='background':
            if value not in ('mist','paper','night'):raise ValueError('Invalid background.')
        else:raise ValueError('Unsupported setting: '+key)
        result[key]=value
    return result
