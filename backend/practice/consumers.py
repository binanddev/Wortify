from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.template.loader import render_to_string

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group=None
        session=self.scope.get('session')
        key=session.session_key if session is not None else None
        if not key or not await database_sync_to_async(session.exists)(key):
            await self.close(code=4401)
            return
        self.key=key
        self.group='learner.'+key
        await self.channel_layer.group_add(self.group,self.channel_name)
        await self.accept()
        await self.send(text_data=await self.snapshot())
    async def disconnect(self,code):
        if self.group:
            await self.channel_layer.group_discard(self.group,self.channel_name)
    @database_sync_to_async
    def snapshot(self):
        from .models import Notification
        qs=Notification.objects.filter(session_key=self.key,read_at__isnull=True).order_by('-created_at')
        return render_to_string('practice/notifications_live.html',{'notifications':list(qs[:10]),'notification_count':qs.count(),'csrf_token':self.scope.get('cookies',{}).get('csrftoken','')})
    async def notifications_changed(self,event):
        await self.send(text_data=await self.snapshot())
