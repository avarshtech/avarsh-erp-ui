import { useCallback, useMemo, useState } from 'react';
import { stickerAskQuestions } from '../../../../utils/expDocTemplateSchema';
import { askDefaults, askPrefillRun } from './stickerWorkspaceModel';

/**
 * The layout's once-per-run questions ("BATCH #") and this run's answers.
 *
 * An answer starts from an earlier run of the same template (`askPrefillRun`) and is kept
 * per layout and per that run, so a switch of layout or selection prefills afresh with no
 * reset effect, and nothing typed is lost to a re-render. `askValues` is what prints and
 * is recorded: the layout's own questions, trimmed.
 */
const useAskAnswers = (ctx) => {
  const [typed, setTyped] = useState({});
  const layout = ctx?.layout;
  const questions = useMemo(() => stickerAskQuestions(layout?.stickerLayout), [layout]);
  const source = useMemo(() => askPrefillRun(ctx?.runs, layout, ctx?.selectedRanges), [ctx, layout]);
  const slot = `${layout?.id ?? ''}|${source?.id ?? ''}`;

  const answers = useMemo(
    () => ({ ...askDefaults(questions, source), ...typed[slot] }),
    [questions, source, typed, slot],
  );
  const askValues = useMemo(
    () => Object.fromEntries(questions.map(({ key }) => [key, String(answers[key] ?? '').trim()])),
    [questions, answers],
  );
  const setAnswer = useCallback(
    (key, value) => setTyped((all) => ({ ...all, [slot]: { ...all[slot], [key]: value } })),
    [slot],
  );

  return {
    questions,
    answers,
    askValues,
    setAnswer,
    unanswered: questions.find(({ key }) => !askValues[key]) || null,
  };
};

export default useAskAnswers;
