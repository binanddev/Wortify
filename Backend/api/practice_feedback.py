"""Practice-only learner feedback, explicit editorial review and server-graded results."""
from copy import deepcopy

from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from practice.models import AnswerProposal, PracticeAttempt, PracticeNode
from .common import endpoint, body
from .content_workspace import is_editor
from .practice_hub import visible, validate_payload


def reviewable(request, node):
    if node.owner_id == request.user.pk:
        return True
    if is_editor(request.user):
        from .content_merge import publisher
        owner = publisher()
        return bool(owner and owner.pk == node.owner_id)
    return False


def exercise(request, pk, lock=False):
    accessible = get_object_or_404(visible(request, include_personal=True), pk=pk, kind='exercise')
    node = PracticeNode.objects.select_for_update().get(pk=accessible.pk) if lock else accessible
    if node.payload.get('presentation', {}).get('interaction') == 'reading':
        raise ValueError('Use this feature only for Practice Hub exercises.')
    return node


def serialized(proposal):
    return {'id': str(proposal.pk), 'question_id': proposal.question_id,
            'question_prompt': proposal.question_prompt, 'answer': proposal.answer,
            'reason': proposal.reason, 'status': proposal.status,
            'revision': proposal.revision, 'created_at': proposal.created_at.isoformat()}


@endpoint
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def proposals(request, pk):
    node = exercise(request, pk, lock=request.method == 'POST')
    can_review = reviewable(request, node)
    if request.method == 'GET':
        rows = AnswerProposal.objects.filter(node=node)
        if not can_review:
            rows = rows.filter(user=request.user)
        return JsonResponse({'proposals': [serialized(p) for p in rows[:100]],
                             'can_review': can_review, 'revision': node.updated_at.isoformat()})
    data = body(request)
    if data.get('revision') != node.updated_at.isoformat():
        return JsonResponse({'error': 'This exercise changed. Reload before proposing an answer.'}, status=409)
    question_id = data.get('question_id')
    question = next((q for q in node.payload.get('questions', []) if q['id'] == question_id and not q.get('example')), None)
    mode = node.payload.get('presentation', {}).get('interaction', 'short_answer')
    if not question or mode not in ('short_answer', 'error_correction', 'audio_dictation') or question.get('blanks'):
        raise ValueError('Suggest an alternative only for a free-text answer.')
    answer, reason = data.get('answer'), data.get('reason', '')
    if not isinstance(answer, str) or not 1 <= len(answer.strip()) <= 2000:
        raise ValueError('Proposed answer must contain 1–2000 characters.')
    if not isinstance(reason, str) or len(reason) > 2000:
        raise ValueError('Reason must contain at most 2000 characters.')
    answer = answer.strip()
    if answer in question['accepted_answers']:
        raise ValueError('This answer is already accepted.')
    existing = AnswerProposal.objects.filter(node=node, user=request.user, question_id=question_id,
                                             revision=data['revision'], answer=answer, status='pending').first()
    if existing:
        return JsonResponse({'proposal': serialized(existing)}, status=200)
    if AnswerProposal.objects.filter(node=node, user=request.user, status='pending').count() >= 20:
        raise ValueError('You already have 20 pending suggestions for this exercise. Wait for review.')
    proposal = AnswerProposal.objects.create(node=node, user=request.user, question_id=question_id,
        revision=data['revision'], question_prompt=question['prompt'], answer=answer, reason=reason.strip())
    return JsonResponse({'proposal': serialized(proposal)}, status=201)


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def review(request, pk, proposal_id):
    node = exercise(request, pk, lock=True)
    if not reviewable(request, node):
        return JsonResponse({'error': 'Only the content owner or shared-library editors can review suggestions.'}, status=403)
    proposal = get_object_or_404(AnswerProposal.objects.select_for_update(), pk=proposal_id, node=node)
    data = body(request)
    decision = data.get('decision')
    if decision not in ('approve', 'reject'):
        raise ValueError('Choose approve or reject.')
    target = 'approved' if decision == 'approve' else 'rejected'
    if proposal.status != 'pending':
        if proposal.status != target:
            return JsonResponse({'error': 'This suggestion has already been reviewed.'}, status=409)
        return JsonResponse({'proposal': serialized(proposal), 'revision': node.updated_at.isoformat()})
    if decision == 'approve':
        if data.get('revision') != node.updated_at.isoformat() or proposal.revision != node.updated_at.isoformat():
            return JsonResponse({'error': 'The exercise changed after this suggestion. Review the current question; this suggestion cannot be approved automatically.'}, status=409)
        payload = deepcopy(node.payload)
        question = next((q for q in payload['questions'] if q['id'] == proposal.question_id), None)
        mode = payload.get('presentation', {}).get('interaction', 'short_answer')
        if not question or question.get('blanks') or mode not in ('short_answer', 'error_correction', 'audio_dictation'):
            raise ValueError('This question no longer accepts alternative text answers.')
        if proposal.answer not in question['accepted_answers']:
            question['accepted_answers'].append(proposal.answer)
        node.payload = validate_payload('exercise', payload)
        node.save(update_fields=['payload', 'updated_at'])
    proposal.status = target
    proposal.reviewed_by = request.user
    proposal.reviewed_at = timezone.now()
    proposal.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
    from .management import audit
    audit(request, node, f'{target.title()} answer suggestion {proposal.pk} for question {proposal.question_id}')
    return JsonResponse({'proposal': serialized(proposal), 'revision': node.updated_at.isoformat()})


def save_result(request, data, token):
    """Grade submitted answers on server; interaction counts are reported telemetry."""
    from .learning_sync import grade_payload
    node = exercise(request, data.get('node'), lock=True)
    revision = node.updated_at.isoformat()
    if data.get('revision') != revision:
        return {'outdated': True}
    mode = data.get('mode')
    if mode not in ('practice', 'self_check'):
        raise ValueError('Choose practice or self_check mode.')
    answers, records = data.get('answers', {}), data.get('records', {})
    if not isinstance(answers, dict) or len(answers) > 1000 or len(str(answers)) > 250000:
        raise ValueError('Invalid practice answers.')
    questions = [q for q in node.payload['questions'] if not q.get('example')]
    valid = {str(q['id']) for q in questions}
    selected = data.get('question_ids')
    if selected is not None:
        if not isinstance(selected, list) or not selected or len(selected) > 100 or any(not isinstance(qid, str) or qid not in valid for qid in selected) or len(set(selected)) != len(selected):
            raise ValueError('Choose distinct question IDs from this exercise.')
        questions = [q for q in questions if str(q['id']) in selected]
        valid = set(selected)
    answer_keys = {key for q in questions for key in ([f"{q['id']}_{i}" for i in range(len(q.get('blanks', [])))] or [str(q['id'])])}
    if any(key not in answer_keys for key in answers):
        raise ValueError('Answers contain questions outside this session.')
    if not isinstance(records, dict) or any(key not in valid for key in records):
        raise ValueError('Session records contain invalid questions.')
    for record in records.values():
        if not isinstance(record, dict) or set(record) - {'attempts', 'firstCorrect', 'revealed', 'hinted'}:
            raise ValueError('Invalid question record.')
        if type(record.get('attempts', 0)) is not int or not 0 <= record.get('attempts', 0) <= 1000:
            raise ValueError('Attempts must be between 0 and 1000.')
        if any(type(record.get(key, False)) is not bool for key in ('firstCorrect', 'revealed', 'hinted')):
            raise ValueError('Question states must be booleans.')
    rows = []
    summary = {'mode': mode, 'first_correct': 0, 'after_retry': 0, 'revealed': 0, 'hinted': 0, 'answered': 0,
               'interaction_counts_source': 'learner_reported'}
    for question in questions:
        qid = str(question['id'])
        record = records.get(qid, {})
        keys = [f'{qid}_{i}' for i in range(len(question.get('blanks', [])))] or [qid]
        submitted = all(key in answers and answers[key] not in ('', [], None) for key in keys)
        # Revealing is an explicit skip, so partially typed/invalid answers must
        # not prevent the rest of a completed session from being persisted.
        if record.get('revealed'):
            graded = [{'key': key, 'question_position': question['position'], 'correct': False,
                       'revealed': True, 'unanswered': not submitted} for key in keys]
            summary['revealed'] += 1
            summary['answered'] += int(submitted)
        elif submitted:
            graded = grade_payload({**node.payload, 'questions': [question]}, answers)['answers']
            summary['answered'] += 1
        else:
            graded = [{'key': key, 'question_position': question['position'], 'correct': False, 'unanswered': True} for key in keys]
        if record.get('hinted'):
            summary['hinted'] += 1
        correct = all(row['correct'] for row in graded)
        if correct and record.get('firstCorrect') and record.get('attempts') == 1 and not record.get('hinted'):
            summary['first_correct'] += 1
        elif correct and record.get('attempts', 0) > 1:
            summary['after_retry'] += 1
        rows.extend(graded)
    result = {'score': sum(row['correct'] for row in rows), 'total': len(rows), 'answers': rows, 'summary': summary}
    PracticeAttempt.objects.create(user=request.user, node=node, token=token, answers=answers, result=result)
    return result
