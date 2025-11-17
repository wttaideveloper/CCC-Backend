export function getDatesInMonth(year: number, month: number): Date[] {
    const dates: Date[] = [];
    let date = new Date(year, month, 1);

    while (date.getMonth() === month) {
        dates.push(new Date(date));
        date = new Date(date.setDate(date.getDate() + 1));
    }

    return dates;
}

export function generateMonthlyAvailability(
    weeklySlots: { day: number; slots: HourSlot[] }[],
    year: number,
    month: number
) {
    const allDates = getDatesInMonth(year, month);

    return allDates.map((d: Date) => {
        const weekday = d.getDay();
        const daySlots = weeklySlots.find(w => w.day === weekday);

        return {
            date: d.toISOString().split('T')[0],
            day: weekday,
            slots: daySlots ? daySlots.slots : []
        };
    });
}

export function convertSlotToMinutes(time: string, period: 'AM' | 'PM'): number {
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

    let total = hours * 60 + minutes;

    if (period === 'PM' && hours !== 12) total += 12 * 60;
    if (period === 'AM' && hours === 12) total -= 12 * 60;

    return total;
}

export function convertToMinutes(date: Date): number {
    return date.getHours() * 60 + date.getMinutes();
}

export function splitIntoDurationSlots(
    startTime: string,
    startPeriod: 'AM' | 'PM',
    endTime: string,
    endPeriod: 'AM' | 'PM',
    durationMinutes: number
): HourSlot[] {

    const result: HourSlot[] = [];

    const startHour = convertTo24(startTime, startPeriod);
    const endHour = convertTo24(endTime, endPeriod);

    let cursor = startHour * 60;
    const limit = endHour * 60;

    while (cursor + durationMinutes <= limit) {
        const slotEnd = cursor + durationMinutes;

        const start12 = minutesTo12h(cursor);
        const end12 = minutesTo12h(slotEnd);

        result.push({
            startTime: start12.time,
            startPeriod: start12.period as 'AM' | 'PM',
            endTime: end12.time,
            endPeriod: end12.period as 'AM' | 'PM'
        });

        cursor += durationMinutes;
    }

    return result;
}

function convertTo24(time: string, period: 'AM' | 'PM') {
    let hr = parseInt(time, 10);
    if (period === 'PM' && hr !== 12) hr += 12;
    if (period === 'AM' && hr === 12) hr = 0;
    return hr;
}

function minutesTo12h(totalMinutes: number) {
    const hour = Math.floor(totalMinutes / 60);
    const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 === 0 ? 12 : hour % 12;

    return {
        time: h.toString(),
        period
    };
}

export interface HourSlot {
    startTime: string;
    startPeriod: 'AM' | 'PM';
    endTime: string;
    endPeriod: 'AM' | 'PM';
}

export interface WeeklySlot {
    day: number;
    slots: HourSlot[];
}
