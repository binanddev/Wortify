"""Teacher-opted, revocable lesson links. No class/member/assignment data is public."""
import uuid
from django.db import transaction
from django.http import JsonResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from users.models import TeachingBoard, BoardPDF
from .common import endpoint, public_endpoint, body
from .teaching import room, snapshot_response
from .teaching_realtime import configuration, sign, committed_event


def shared_board(request, token):
    return get_object_or_404(TeachingBoard.objects.defer('state'), public_token=token, public_enabled=True,
                            classroom__language=request.language, classroom__owner__is_active=True)


def sharing_data(board):
    return {'enabled': board.public_enabled, 'path': f'/{board.classroom.language}/classes/public/{board.public_token}' if board.public_enabled else None}


@endpoint
@require_http_methods(['GET','POST'])
def sharing(request, pk, board_id):
    classroom=room(request,pk,True)
    board=get_object_or_404(TeachingBoard.objects.defer('state'),pk=board_id,classroom=classroom)
    if request.method=='GET':return JsonResponse(sharing_data(board))
    data=body(request)
    if type(data.get('enabled')) is not bool or type(data.get('rotate',False)) is not bool:
        raise ValueError('Choose whether to enable public lesson sharing.')
    with transaction.atomic():
        board=TeachingBoard.objects.select_for_update().get(pk=board.pk)
        board.public_enabled=data['enabled']
        board.public_token=uuid.uuid4() if data.get('rotate') or not board.public_enabled else board.public_token
        board.public_version+=1
        board.revision+=1
        board.save()
        board.events.all().delete()
    return JsonResponse({**sharing_data(board),'revision':board.revision,'state':board.state,
                         'notification':committed_event(request,board,'invalidate')})


@public_endpoint
@require_http_methods(['GET'])
def info(request, token):
    board=shared_board(request,token)
    return JsonResponse({'id':str(board.pk),'title':board.title,'read_only':True})


@public_endpoint
@require_http_methods(['GET'])
def board(request, token):
    return snapshot_response(request,shared_board(request,token))


@public_endpoint
@require_http_methods(['GET'])
def pdf_content(request,token,asset_id):
    board=shared_board(request,token)
    asset=get_object_or_404(BoardPDF,pk=asset_id,board=board)
    response=FileResponse(asset.file.open('rb'),content_type='application/pdf',filename=asset.name)
    response['X-Robots-Tag']='noindex, nofollow, noarchive'
    response['X-Content-Type-Options']='nosniff'
    return response


@public_endpoint
@require_http_methods(['GET'])
def ticket(request,token):
    board=shared_board(request,token)
    url=configuration()
    if not url:return JsonResponse({'enabled':False})
    from .teaching_local import ensure_local_relay
    if not ensure_local_relay():return JsonResponse({'enabled':False})
    proof=sign('ticket',{'room':str(board.pk),'user':0,'write':False,'public':True,'access':board.public_version})
    return JsonResponse({'enabled':True,'url':url,'ticket':proof})
