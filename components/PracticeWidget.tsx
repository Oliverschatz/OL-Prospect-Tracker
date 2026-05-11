'use client';

import { useMemo, useState } from 'react';
import { practiceQuestions, type PracticeQuestion } from '@/lib/practice-questions';

function pickRandom(exclude?: string): PracticeQuestion {
  const pool = exclude ? practiceQuestions.filter((q) => q.id !== exclude) : practiceQuestions;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function PracticeWidget() {
  const initial = useMemo(() => pickRandom(), []);
  const [question, setQuestion] = useState<PracticeQuestion>(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const answered = selected !== null;
  const isCorrect = answered && selected === question.correctIndex;

  function handleSelect(idx: number) {
    if (answered) return;
    setSelected(idx);
    setScore((s) => ({
      correct: s.correct + (idx === question.correctIndex ? 1 : 0),
      total: s.total + 1,
    }));
  }

  function handleNext() {
    setQuestion(pickRandom(question.id));
    setSelected(null);
  }

  return (
    <div className="pw-root">
      <div className="pw-card">
        <div className="pw-header">
          <span className="pw-badge">Practice Question</span>
          <span className="pw-score">
            Score: {score.correct} / {score.total}
          </span>
        </div>

        <h2 className="pw-question">{question.question}</h2>

        <div className="pw-options">
          {question.options.map((opt, idx) => {
            const isSelected = selected === idx;
            const isRightAnswer = idx === question.correctIndex;
            let stateClass = '';
            if (answered) {
              if (isRightAnswer) stateClass = 'pw-opt-correct';
              else if (isSelected) stateClass = 'pw-opt-wrong';
              else stateClass = 'pw-opt-muted';
            }
            return (
              <button
                key={idx}
                type="button"
                className={`pw-option ${stateClass}`}
                onClick={() => handleSelect(idx)}
                disabled={answered}
              >
                <span className="pw-letter">{String.fromCharCode(65 + idx)}</span>
                <span className="pw-opt-text">{opt}</span>
                {answered && isRightAnswer && <span className="pw-mark">✓</span>}
                {answered && isSelected && !isRightAnswer && <span className="pw-mark">✗</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={`pw-feedback ${isCorrect ? 'pw-feedback-ok' : 'pw-feedback-bad'}`}>
            <div className="pw-feedback-title">
              {isCorrect ? 'Correct!' : 'Not quite.'}
            </div>
            {question.explanation && <div className="pw-feedback-text">{question.explanation}</div>}
          </div>
        )}

        <div className="pw-actions">
          <button
            type="button"
            className="pw-next"
            onClick={handleNext}
            disabled={!answered}
          >
            Next question →
          </button>
        </div>
      </div>

      <style jsx>{`
        .pw-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: var(--pbf-light, #f7f8fa);
          font-family: 'Source Sans 3', -apple-system, sans-serif;
          color: var(--pbf-text, #2d3748);
        }
        .pw-card {
          width: 100%;
          max-width: 560px;
          background: #fff;
          border: 1px solid var(--pbf-border, #d8dde6);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06);
          padding: 20px 22px;
        }
        .pw-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .pw-badge {
          background: var(--pbf-navy, #1a2744);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .pw-score {
          font-size: 13px;
          color: var(--pbf-muted, #718096);
          font-weight: 600;
        }
        .pw-question {
          font-family: 'Source Serif 4', Georgia, serif;
          font-size: 19px;
          font-weight: 600;
          line-height: 1.4;
          margin: 6px 0 18px;
          color: var(--pbf-navy, #1a2744);
        }
        .pw-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pw-option {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-align: left;
          padding: 12px 14px;
          border: 1.5px solid var(--pbf-border, #d8dde6);
          border-radius: 6px;
          background: #fff;
          font-size: 14.5px;
          line-height: 1.4;
          color: var(--pbf-text, #2d3748);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.05s;
        }
        .pw-option:not(:disabled):hover {
          border-color: var(--pbf-blue, #2c5282);
          background: #f5f8fd;
        }
        .pw-option:not(:disabled):active {
          transform: translateY(1px);
        }
        .pw-option:disabled {
          cursor: default;
        }
        .pw-letter {
          flex: 0 0 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--pbf-light, #f7f8fa);
          border: 1px solid var(--pbf-border, #d8dde6);
          font-weight: 700;
          font-size: 12px;
          color: var(--pbf-navy, #1a2744);
        }
        .pw-opt-text {
          flex: 1;
        }
        .pw-mark {
          font-size: 18px;
          font-weight: 700;
        }
        .pw-opt-correct {
          border-color: var(--pbf-green, #276749);
          background: var(--pbf-green-bg, #f0fff4);
          color: var(--pbf-green, #276749);
        }
        .pw-opt-correct .pw-letter {
          background: var(--pbf-green, #276749);
          color: #fff;
          border-color: var(--pbf-green, #276749);
        }
        .pw-opt-wrong {
          border-color: var(--pbf-red, #c53030);
          background: var(--pbf-red-bg, #fff5f5);
          color: var(--pbf-red, #c53030);
        }
        .pw-opt-wrong .pw-letter {
          background: var(--pbf-red, #c53030);
          color: #fff;
          border-color: var(--pbf-red, #c53030);
        }
        .pw-opt-muted {
          opacity: 0.55;
        }
        .pw-feedback {
          margin-top: 16px;
          padding: 12px 14px;
          border-radius: 6px;
          border-left: 4px solid;
          font-size: 14px;
        }
        .pw-feedback-ok {
          background: var(--pbf-green-bg, #f0fff4);
          border-color: var(--pbf-green, #276749);
          color: var(--pbf-green, #276749);
        }
        .pw-feedback-bad {
          background: var(--pbf-red-bg, #fff5f5);
          border-color: var(--pbf-red, #c53030);
          color: var(--pbf-red, #c53030);
        }
        .pw-feedback-title {
          font-weight: 700;
          margin-bottom: 4px;
        }
        .pw-feedback-text {
          color: var(--pbf-text, #2d3748);
          font-weight: 400;
        }
        .pw-actions {
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
        }
        .pw-next {
          background: var(--pbf-accent, #e8a838);
          color: var(--pbf-navy, #1a2744);
          border: none;
          font-weight: 700;
          font-size: 14px;
          padding: 9px 18px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }
        .pw-next:hover:not(:disabled) {
          background: var(--pbf-accent-hover, #d4952e);
        }
        .pw-next:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
