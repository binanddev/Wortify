def validate_preferences(data):
    numeric={'font':(24,60),'volume':(0,1),'transparency':(0,85),'textSize':(16,22)}
    result={}
    for key,value in data.items():
        if key in numeric:
            lo,hi=numeric[key]
            if type(value) not in (int,float) or not lo<=value<=hi:raise ValueError('Giá trị cài đặt không hợp lệ: '+key)
        elif key in ('sound','ambient','navPinned'):
            if type(value) is not bool:raise ValueError('Cài đặt âm thanh không hợp lệ.')
        elif key=='background':
            if value not in ('mist','paper','night'):raise ValueError('Nền không hợp lệ.')
        else:raise ValueError('Cài đặt không được hỗ trợ: '+key)
        result[key]=value
    return result
