export function calculateSectionScore(
    layers: { selectedChoice: string }[],
): number | null {
    if (!layers?.length) return null;

    const frequency: Record<string, number> = {};

    for (const layer of layers) {
        const key = layer.selectedChoice;
        frequency[key] = (frequency[key] || 0) + 1;
    }

    let max = 0;
    let winnerKey: string | null = null;

    for (const [key, count] of Object.entries(frequency)) {
        if (count > max) {
            max = count;
            winnerKey = key;
        }
    }

    if (!winnerKey) return null;

    const numericScore = Number(winnerKey);

    return Number.isNaN(numericScore) ? null : numericScore;
}