import type { AttendanceDto } from "@dddtw/contracts";
import type { CheckinReadModel } from "./read-model";

export class GetAttendance {
  constructor(private readonly readModel: CheckinReadModel) {}

  async execute(eventId: string): Promise<AttendanceDto> {
    const byTicketType = await this.readModel.attendanceByTicketType(eventId);
    return {
      eventId,
      confirmedTotal: byTicketType.reduce((sum, r) => sum + r.confirmed, 0),
      checkedIn: byTicketType.reduce((sum, r) => sum + r.checkedIn, 0),
      byTicketType,
    };
  }
}
