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

export const SESSION_FLOW = [
    {
        phaseName: "Self Revitalization Phase",
        totalSessions: 1,
    },
    {
        phaseName: "Church Empowerment Phase",
        totalSessions: 5,
    },
    {
        phaseName: "Community Revitalization and Multiplication Phase",
        totalSessions: 4,
    }
];

export const SESSION_NOTES = [
    "Session 1—Building Trust, Self-Awareness & Resources",
    "Session 2—Creating a Life of Prayer, Vision, & Family Balance",
    "Session 3—Empowering Disciples & Addressing Resistance",
    "Session 4—Fostering a Culture of Hospitality & Generosity",
    "Session 5—Building Social Bridges",
    "Session 6—Creating Community Engagement Frameworks",
    "Session 7—Training & Equipping for Community Engagement",
    "Session 8—Transforming Community through Active Presence",
    "Session 9—Celebrating & Envisioning Growth",
    "Session 10—Expanding Mentoring Networks"
];

export function normalizeRoadmapName(name: string): string {
    return name
        ?.trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}