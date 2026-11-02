import {useEffect, useState} from 'react';
import {t as tr} from '../../i18n/index.js';
import {Btn, Status} from '../../components/ui/ui.jsx';
import {endpoint, request, useAction} from '../../lib/core.js';
import {ExerciseForm, prepareExercise} from './exercise-authoring.jsx';
import {MediaEditor} from './exercise-media.jsx';

// Preserve legacy fields that the concise text format cannot represent.
export function needsStructuredEditor(exercise) {
  const mode = exercise.presentation?.interaction;
  return ['audio_dictation','inline_error_identification'].includes(mode)
    || (mode === 'multiple_choice' && exercise.kind === 'multi')
    || (mode === 'sentence_building' && exercise.questions.some(q =>
      q.presentation?.tokens?.some(token => !q.accepted_answers.includes(token.id))));
}

export default function PracticeStructuredEditor({exercise, lang, pending, onBusyChange, onDirtyChange, onApply}) {
  const [value,setValue] = useState(() => structuredClone(exercise));
  const [mediaBusy,setMediaBusy] = useState(false);
  const action = useAction();
  useEffect(() => {onBusyChange?.(mediaBusy || action.pending);},[mediaBusy,action.pending,onBusyChange]);
  useEffect(() => () => onBusyChange?.(false),[onBusyChange]);
  const change = patch => {setValue(previous => ({...previous,...patch})); onDirtyChange?.(true);};
  const upload = (file,done) => action.run(async signal => {
    const form = new FormData(); form.append('file',file);
    const {media} = await request(endpoint(lang,'practice-hub/media/'),'POST',form,signal);
    done(media.url);
    setValue(previous => ({...previous,attachments:[...(previous.attachments || []),media]}));
    onDirtyChange?.(true);
  });
  return <div>
    <Status error={action.error}/>
    <ExerciseForm exercise={value} onChange={change} onUpload={upload}/>
    <MediaEditor lang={lang} items={value.attachments || []} questions={value.questions}
      disabled={pending || action.pending} onBusy={setMediaBusy} onChange={attachments=>change({attachments})}/>
    <Btn primary isDisabled={pending || mediaBusy || action.pending} onClick={()=>{
      const payload=prepareExercise(value);
      onApply([{kind:'exercise',title:payload.title,payload}]);
    }}>{tr('Save changes')}</Btn>
  </div>;
}
