import { EventEmitter } from "events";
import type { TriageEvent } from "../../types/triage";

class TriageBus {
  private emitters = new Map<string, EventEmitter>();

  create(runId: string): EventEmitter {
    const emitter = new EventEmitter();
    this.emitters.set(runId, emitter);
    emitter.once("end", () => {
      setTimeout(() => this.emitters.delete(runId), 30000);
    });
    return emitter;
  }

  get(runId: string): EventEmitter | undefined {
    return this.emitters.get(runId);
  }

  publish(runId: string, event: TriageEvent): void {
    const emitter = this.emitters.get(runId);
    if (emitter) {
      emitter.emit("event", event);
      if (event.type === "decision_finalized") {
        emitter.emit("end");
      }
    }
  }
}

export const triageBus = new TriageBus();
