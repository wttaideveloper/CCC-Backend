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

    const startMinutes = convertSlotToMinutes(startTime, startPeriod);
    const endMinutes = convertSlotToMinutes(endTime, endPeriod);

    let cursor = startMinutes;
    const limit = endMinutes;

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
    const hour24 = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';

    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    return {
        time: `${hour12}:${minutes.toString().padStart(2, '0')}`,
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

export function buildSlotDate(dateStr: string, slot: HourSlot): Date {
    const base = new Date(dateStr);

    let hour = parseInt(slot.startTime, 10);

    if (slot.startPeriod === 'PM' && hour !== 12) hour += 12;
    if (slot.startPeriod === 'AM' && hour === 12) hour = 0;

    base.setHours(hour, 0, 0, 0);
    return base;
}

export function getWeekRange(dateStr: string): Date[] {
    const input = new Date(dateStr);

    const start = new Date(input);
    start.setDate(input.getDate() - input.getDay());
    start.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    const cursor = new Date(start);

    for (let i = 0; i < 7; i++) {
        days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return days; 
}