def validate_preferences(data):
    numeric={'navScale':(50,150),'font':(24,60),'volume':(0,1),'transparency':(0,100),'textSize':(16,22),'textWeight':(400,700),'textContrast':(0,100),'curvature':(0,32),'glassLens':(0,100)}
    result={}
    for key,value in data.items():
        if key in numeric:
            lo,hi=numeric[key]
            if type(value) not in (int,float) or not lo<=value<=hi:raise ValueError('Giá trị cài đặt không hợp lệ: '+key)
        elif key in ('sound','ambient','navPinned'):
            if type(value) is not bool:raise ValueError('Cài đặt âm thanh không hợp lệ.')
        elif key=='ambientTrack':
            if value not in ('morning','marimba','picnic','bubbles','cafe','garden','puzzle','clouds','starlight','steps','bounce','ghost','begin','ukulele','island','tropical','sunshine','arcade','dew','hearth'):raise ValueError('Giai điệu nền không hợp lệ.')
        elif key=='appearanceSelections':
            if not isinstance(value,dict) or len(value)>300:raise ValueError('Cài đặt theme không hợp lệ.')
            for name, settings in value.items():
                if not isinstance(name,str) or (name!='default' and not name.isdecimal()):raise ValueError('Theme không hợp lệ.')
                if not isinstance(settings,dict) or set(settings)-{'interface','background'}:raise ValueError('Thông số theme không hợp lệ.')
                validate_preferences(settings)
        elif key=='appearanceProfiles':
            import re
            allowed = {'navScale','font','transparency','textSize','textWeight','textContrast','textColor','curvature','glassLens'}
            if not isinstance(value,dict) or len(value)>300:raise ValueError('Cài đặt giao diện không hợp lệ.')
            for name, settings in value.items():
                if not isinstance(name,str) or not re.fullmatch(r'(default|[0-9]+):(studio|glass|xp|retro|space):(mist|paper|night)',name):raise ValueError('Theme không hợp lệ.')
                if not isinstance(settings,dict) or set(settings)-allowed:raise ValueError('Thông số giao diện không hợp lệ.')
                validate_preferences(settings)
        elif key=='interface':
            if value not in ('studio','glass','xp','retro','space'):raise ValueError('Giao diện không hợp lệ.')
        elif key=='textColor':
            import re
            if not isinstance(value,str) or (value != 'auto' and not re.fullmatch(r'#[0-9a-fA-F]{6}', value)):raise ValueError('Màu chữ không hợp lệ.')
        elif key=='background':
            if value not in ('mist','paper','night'):raise ValueError('Nền không hợp lệ.')
        else:raise ValueError('Cài đặt không được hỗ trợ: '+key)
        result[key]=value
    return result
