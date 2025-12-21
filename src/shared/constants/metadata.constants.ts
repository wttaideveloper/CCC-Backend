interface CountryState {
    country: string;
    states: string[];
}

export const TITLES_LIST: string[] = ['Pastor', 'Lay Leader', 'Seminarian', 'Mentor', 'Field Mentor', 'Director'];

export const INTERESTS_LIST: string[] = [
    'Children/Youth Ministry',
    'Community Outreach',
    'Leadership Development',
    // ... more interests
];

export const COUNTRIES_STATES_LIST: CountryState[] = [
    {
        country: 'United States',
        states: ['California', 'Texas', 'New York'],
    },
    {
        country: 'Canada',
        states: ['Ontario', 'Quebec', 'British Columbia'],
    },
    // ... more
];