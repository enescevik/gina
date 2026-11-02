import type { NotebookDocument } from "./notebook";

/** Keeps an uncertain transport request stable until the server confirms its receipt.
 * A newer local edit is sent only after that receipt is reconciled. */
export interface AnswerValue {
  key?: string;
  text?: string;
  document?: NotebookDocument;
}
export interface AnswerReceipt {
  id: string;
  revision: number;
  answer: AnswerValue;
}
export class AnswerReceipts {
  private uncertain = new Map<string, AnswerReceipt>();
  constructor(
    private send: (question: string, receipt: AnswerReceipt) => Promise<number>,
    private saved: (
      question: string,
      answer: AnswerValue,
      revision: number,
    ) => void,
    private revision: (question: string) => number,
    private id: () => string,
  ) {}
  async write(question: string, answer: AnswerValue) {
    const pending = this.uncertain.get(question);
    let revision = this.revision(question);
    if (pending) {
      revision = await this.send(question, pending);
      this.uncertain.delete(question);
      this.saved(question, pending.answer, revision);
      if (
        pending.answer.key === answer.key &&
        pending.answer.text === answer.text &&
        JSON.stringify(pending.answer.document) ===
          JSON.stringify(answer.document)
      ) return;
    }
    const receipt = {
      id: this.id(),
      revision,
      answer: JSON.parse(JSON.stringify(answer)) as AnswerValue,
    };
    this.uncertain.set(question, receipt);
    const next = await this.send(question, receipt);
    this.uncertain.delete(question);
    this.saved(question, receipt.answer, next);
  }
}
