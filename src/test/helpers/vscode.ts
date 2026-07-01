import Module from 'module';

export class Position {
    public constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    public constructor(public readonly start: Position, public readonly end: Position) {}
}

export interface TextDocument {
    languageId: string;
    getText(range?: Range): string;
    offsetAt(position: Position): number;
    positionAt(offset: number): Position;
}

export interface TextEditorEdit {
    replace(range: Range, value: string): void;
}

export interface TextEditor {
    document: TextDocument;
    selection: {active: Position};
    edit(callback: (editBuilder: TextEditorEdit) => void): void;
}

export interface RecordedMessage {
    text: string;
    type: 'info'|'warning'|'error';
}

export const messages: Array<RecordedMessage> = [];

export const window = {
    activeTextEditor: undefined as TextEditor|undefined,
    showInformationMessage: (text: string) => {
        messages.push({text, type: 'info'});
    },
    showWarningMessage: (text: string) => {
        messages.push({text, type: 'warning'});
    },
    showErrorMessage: (text: string) => {
        messages.push({text, type: 'error'});
    },
};

export const workspace = {
    getConfiguration: () => ({
        get: <T>(_key: string, defaultValue: T): T => defaultValue,
    }),
};

export function resetVscodeMock(): void {
    window.activeTextEditor = undefined;
    messages.length = 0;
}

export function createDocument(text: string, languageId: string = 'php'): TextDocument {
    return {
        languageId,
        getText: (range?: Range) => {
            if (!range) {
                return text;
            }

            return text.slice(range.start.character, range.end.character);
        },
        offsetAt: (position: Position) => position.character,
        positionAt: (offset: number) => new Position(0, offset),
    };
}

export interface FakeEditor {
    editor: TextEditor;
    replacement: {range: Range|null, value: string|null};
}

export function createEditor(text: string, cursorOffset: number, languageId: string = 'php'): FakeEditor {
    const replacement: {range: Range|null, value: string|null} = {range: null, value: null};
    const editor: TextEditor = {
        document: createDocument(text, languageId),
        selection: {active: new Position(0, cursorOffset)},
        edit: (callback) => {
            callback({
                replace: (range: Range, value: string) => {
                    replacement.range = range;
                    replacement.value = value;
                },
            });
        },
    };

    return {editor, replacement};
}

const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
    if (request === 'vscode') {
        return __filename;
    }

    return originalResolveFilename.call(this, request, ...args);
};
