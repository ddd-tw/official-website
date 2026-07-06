import type { CheckinManifestDto } from "@dddtw/contracts";
import type { Clock } from "../../../../shared/ports";
import type { CheckinReadModel } from "./read-model";

/** 離線驗票備案 方案 A: pre-download the admission list before doors open. */
export class GetCheckinManifest {
  constructor(
    private readonly readModel: CheckinReadModel,
    private readonly clock: Clock,
  ) {}

  async execute(eventId: string): Promise<CheckinManifestDto> {
    const entries = await this.readModel.manifestEntries(eventId);
    return {
      eventId,
      generatedAt: this.clock.now().toISOString(),
      entries,
    };
  }
}
