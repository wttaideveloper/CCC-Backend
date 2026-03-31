export function buildMeetingDate(date: Date, slot: any) {

    const [hour, minute] = slot.startTime.split(':').map(Number);

    let finalHour = hour;

    if (slot.startPeriod === 'PM' && hour !== 12) {
        finalHour += 12;
    }

    if (slot.startPeriod === 'AM' && hour === 12) {
        finalHour = 0;
    }

    const d = new Date(date);
    d.setHours(finalHour, minute, 0, 0);

    return d;
}