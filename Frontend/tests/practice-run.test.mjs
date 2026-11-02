import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceGroups, recordCheck, runSummary, weakQuestionIds, newPracticeRun, restorePracticeRun} from '../src/features/practice/practice-run.js';
const exercise = {kind:'text'};
const questions = [{id:'1',accepted_answers:['go']},{id:'2',accepted_answers:['went']}];
test('group banks together, retain inline selection independence and legacy modes', () => {
  const many = Array.from({length: 8}, (_, i) => ({id:String(i)}));
  assert.deepEqual(practiceGroups(many,'cloze_drag_drop','exercise').map(g => g.length), [6,2]);
  assert.equal(practiceGroups(many,'cloze_drag_drop','question').length,8);
  assert.equal(practiceGroups(many,'inline_selection').length,8);
  assert.equal(practiceGroups(many,'true_false_not_given').length,8);
  assert.equal(practiceGroups(many,'matching').length,1);
});
test('retain first answer evidence and select only weak questions for retry', () => {
  const first = recordCheck(exercise,questions,{'1':'go','2':'go'},{});
  const second = recordCheck(exercise,questions,{'1':'go','2':'went'},first.records);
  assert.equal(second.records['1'].attempts,1);
  assert.equal(second.records['2'].attempts,2);
  assert.deepEqual(runSummary(questions,second.records),{first:1,retried:1,revealed:0,incorrect:0,hinted:0});
  assert.deepEqual(weakQuestionIds(questions,second.records),['2']);
});
test('hints and revealed answers never count as independent first-try success', () => {
  const result = recordCheck(exercise,questions,{'1':'go','2':'went'},{'1':{hinted:true},'2':{revealed:true}});
  assert.deepEqual(runSummary(questions,result.records),{first:0,retried:1,revealed:1,incorrect:0,hinted:1});
});
test('saved run retains answers and idempotency token; invalid question selections discarded', () => {
  const run = {...newPracticeRun('self_check'),answers:{'1':'go'}};
  assert.equal(restorePracticeRun(JSON.parse(JSON.stringify(run)),questions).token,run.token);
  assert.equal(restorePracticeRun({...run,ids:['deleted']},questions),null);
  assert.equal(restorePracticeRun({},questions),null);
  assert.equal(restorePracticeRun({...run,index:999},questions),null);
  assert.equal(restorePracticeRun({...run,answers:'broken'},questions),null);
  assert.equal(restorePracticeRun({...run,records:{'1':null}},questions),null);
});
