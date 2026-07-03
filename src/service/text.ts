export function capitalizeFirstCharTrimmed(input: string): string {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
        return trimmedInput;
    }

    return trimmedInput.charAt(0).toUpperCase() + trimmedInput.slice(1);
}

export function arrayToPhpdoc(data: Array<string>, tab: string = ''): string {
    const res: Array<string> = data.map((v) => `${tab} * ${v}`);
    res.unshift(`${tab}/**`);
    res.push(`${tab} */`);

    return `${res.join('\n')}\n`;
}
