import fs from 'fs';
import Module from 'module';
import path from 'path';

export class Position {
    public constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    public constructor(public readonly start: Position, public readonly end: Position) {}
}

export class Selection extends Range {}

export interface TextLine {
    text: string;
    firstNonWhitespaceCharacterIndex: number;
}

export interface Uri {
    fsPath: string;
    path: string;
}

export const Uri = {
    file: (fsPath: string): Uri => ({fsPath, path: fsPath}),
    joinPath: (base: Uri, ...segments: Array<string>): Uri => Uri.file(path.join(base.fsPath, ...segments)),
};

export class Location {
    public readonly uri: Uri;
    public readonly range: Range;

    public constructor(uri: Uri, rangeOrPosition: Range|Position) {
        this.uri = uri;
        this.range = rangeOrPosition instanceof Range
            ? rangeOrPosition
            : new Range(rangeOrPosition, rangeOrPosition);
    }
}

export class CodeLens {
    public constructor(public readonly range: Range, public readonly command?: unknown) {}
}

export enum CompletionItemKind {
    Field = 4,
    Variable = 5,
}

export class CompletionItem {
    public range?: Range;
    public insertText?: string;
    public detail?: string;

    public constructor(public readonly label: string, public readonly kind?: CompletionItemKind) {}
}

export interface TextDocument {
    languageId: string;
    fileName: string;
    uri: Uri;
    lineCount: number;
    getText(range?: Range): string;
    offsetAt(position: Position): number;
    positionAt(offset: number): Position;
    lineAt(line: number): TextLine;
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range|undefined;
}

export interface TextEditorEdit {
    replace(location: Range|Position, value: string): void;
    insert(location: Position, value: string): void;
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

export interface Disposable {
    dispose(): void;
}

export interface FileSystemWatcher extends Disposable {
    onDidChange(listener: () => void): Disposable;
    onDidCreate(listener: () => void): Disposable;
    onDidDelete(listener: () => void): Disposable;
}

export const messages: Array<RecordedMessage> = [];

export const configValues: Record<string, unknown> = {};

interface WatcherListeners {
    onDidChange: Array<() => void>;
    onDidCreate: Array<() => void>;
    onDidDelete: Array<() => void>;
}

const watcherListeners: WatcherListeners = {
    onDidChange: [],
    onDidCreate: [],
    onDidDelete: [],
};

export const window = {
    activeTextEditor: undefined as TextEditor|undefined,
    quickPickResult: undefined as Array<string>|undefined,
    lastQuickPickItems: undefined as Array<string>|undefined,
    showInformationMessage: (text: string) => {
        messages.push({text, type: 'info'});
    },
    showWarningMessage: (text: string) => {
        messages.push({text, type: 'warning'});
    },
    showErrorMessage: (text: string) => {
        messages.push({text, type: 'error'});
    },
    showQuickPick: async (items: Array<string>, _options?: unknown) => {
        window.lastQuickPickItems = items;

        return window.quickPickResult;
    },
};

export function setQuickPickResult(items: Array<string>|undefined): void {
    window.quickPickResult = items;
}

function globToRegExp(glob: string): RegExp {
    let source = '';
    for (let i = 0; i < glob.length; i++) {
        const char = glob[i];
        if (char === '*' && glob[i + 1] === '*') {
            i++;
            if (glob[i + 1] === '/') {
                source += '(?:.*/)?';
                i++;
            } else {
                source += '.*';
            }
        } else if (char === '*') {
            source += '[^/]*';
        } else if (char === '{') {
            const end = glob.indexOf('}', i);
            source += `(?:${glob.slice(i + 1, end).split(',').join('|')})`;
            i = end;
        } else if ('.+^$()|[]\\'.includes(char)) {
            source += `\\${char}`;
        } else {
            source += char;
        }
    }

    return new RegExp(`^${source}$`);
}

function walkDirectory(root: string, dir: string, matches: Array<Uri>, include: RegExp, exclude: RegExp|null): void {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');
        if (exclude && exclude.test(relativePath)) {
            continue;
        }

        if (entry.isDirectory()) {
            walkDirectory(root, fullPath, matches, include, exclude);
        } else if (include.test(relativePath)) {
            matches.push(Uri.file(fullPath));
        }
    }
}

export const workspace = {
    workspaceFolders: undefined as Array<{uri: {fsPath: string}}>|undefined,
    getConfiguration: () => ({
        get: <T>(key: string, defaultValue: T): T => (key in configValues ? configValues[key] as T : defaultValue),
    }),
    createFileSystemWatcher: (): FileSystemWatcher => ({
        onDidChange: (listener: () => void) => {
            watcherListeners.onDidChange.push(listener);

            return {dispose: () => {}};
        },
        onDidCreate: (listener: () => void) => {
            watcherListeners.onDidCreate.push(listener);

            return {dispose: () => {}};
        },
        onDidDelete: (listener: () => void) => {
            watcherListeners.onDidDelete.push(listener);

            return {dispose: () => {}};
        },
        dispose: () => {},
    }),
    openTextDocument: async (uri: Uri): Promise<TextDocument> => {
        const text = fs.readFileSync(uri.fsPath, 'utf-8');
        const languageId = uri.fsPath.endsWith('.twig') ? 'twig' : uri.fsPath.endsWith('.php') ? 'php' : 'yaml';

        return createDocument(text, languageId, uri.fsPath);
    },
    fs: {
        stat: async (uri: Uri): Promise<{type: number}> => {
            if (!fs.existsSync(uri.fsPath)) {
                throw new Error(`File not found: ${uri.fsPath}`);
            }

            return {type: fs.statSync(uri.fsPath).isDirectory() ? 2 : 1};
        },
        writeFile: async (uri: Uri, content: Uint8Array): Promise<void> => {
            fs.mkdirSync(path.dirname(uri.fsPath), {recursive: true});
            fs.writeFileSync(uri.fsPath, Buffer.from(content));
        },
        createDirectory: async (uri: Uri): Promise<void> => {
            fs.mkdirSync(uri.fsPath, {recursive: true});
        },
    },
    findFiles: async (include: string, exclude?: string): Promise<Array<Uri>> => {
        if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
            return [];
        }

        const matches: Array<Uri> = [];
        const includeRegExp = globToRegExp(include);
        const excludeRegExp = exclude ? globToRegExp(exclude) : null;
        workspace.workspaceFolders.forEach((folder) => {
            if (fs.existsSync(folder.uri.fsPath)) {
                walkDirectory(folder.uri.fsPath, folder.uri.fsPath, matches, includeRegExp, excludeRegExp);
            }
        });

        return matches;
    },
};

export function setWorkspaceFolder(fsPath: string): void {
    workspace.workspaceFolders = [{uri: {fsPath}}];
}

export function setConfig(key: string, value: unknown): void {
    configValues[key] = value;
}

export function triggerComposerJsonChange(): void {
    watcherListeners.onDidChange.forEach((listener) => listener());
}

export function resetVscodeMock(): void {
    window.activeTextEditor = undefined;
    window.quickPickResult = undefined;
    window.lastQuickPickItems = undefined;
    workspace.workspaceFolders = undefined;
    messages.length = 0;
    Object.keys(configValues).forEach((key) => delete configValues[key]);
    watcherListeners.onDidChange.length = 0;
    watcherListeners.onDidCreate.length = 0;
    watcherListeners.onDidDelete.length = 0;
}

function offsetAt(lines: Array<string>, position: Position): number {
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
        offset += (lines[i]?.length ?? 0) + 1;
    }

    return offset + position.character;
}

function positionAt(lines: Array<string>, offset: number): Position {
    let remaining = offset;
    for (let i = 0; i < lines.length; i++) {
        if (remaining <= lines[i].length) {
            return new Position(i, remaining);
        }

        remaining -= lines[i].length + 1;
    }

    return new Position(lines.length - 1, lines[lines.length - 1]?.length ?? 0);
}

export function createDocument(text: string, languageId: string = 'php', fileName: string = ''): TextDocument {
    const lines = text.split('\n');

    return {
        languageId,
        fileName,
        uri: Uri.file(fileName),
        lineCount: lines.length,
        getText: (range?: Range) => {
            if (!range) {
                return text;
            }

            return text.slice(offsetAt(lines, range.start), offsetAt(lines, range.end));
        },
        offsetAt: (position: Position) => offsetAt(lines, position),
        positionAt: (offset: number) => positionAt(lines, offset),
        lineAt: (line: number) => {
            const lineText = lines[line] ?? '';

            return {
                text: lineText,
                firstNonWhitespaceCharacterIndex: lineText.length - lineText.trimStart().length,
            };
        },
        getWordRangeAtPosition: (position: Position, regex: RegExp = /[A-Za-z0-9_]+/u) => {
            const lineText = lines[position.line] ?? '';
            const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
            const matcher = new RegExp(regex.source, flags);
            let match: RegExpExecArray|null;
            while ((match = matcher.exec(lineText)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                if (position.character >= start && position.character <= end) {
                    return new Range(new Position(position.line, start), new Position(position.line, end));
                }

                if (match[0].length === 0) {
                    matcher.lastIndex++;
                }
            }

            return undefined;
        },
    };
}

export interface RecordedEdit {
    type: 'replace'|'insert';
    location: Range|Position;
    value: string;
}

export interface FakeEditor {
    editor: TextEditor;
    replacement: {location: Range|Position|null, value: string|null};
    edits: Array<RecordedEdit>;
}

export interface CreateEditorOptions {
    languageId?: string;
    fileName?: string;
}

export function createEditor(text: string, cursorOffset: number, options: CreateEditorOptions = {}): FakeEditor {
    const replacement: {location: Range|Position|null, value: string|null} = {location: null, value: null};
    const edits: Array<RecordedEdit> = [];
    const record = (type: 'replace'|'insert', location: Range|Position, value: string) => {
        replacement.location = location;
        replacement.value = value;
        edits.push({type, location, value});
    };
    const editor: TextEditor = {
        document: createDocument(text, options.languageId ?? 'php', options.fileName ?? ''),
        selection: {active: new Position(0, cursorOffset)},
        edit: (callback) => {
            callback({
                replace: (location: Range|Position, value: string) => record('replace', location, value),
                insert: (location: Position, value: string) => record('insert', location, value),
            });
        },
    };

    return {editor, replacement, edits};
}

const originalResolveFilename = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, ...args: any[]) {
    if (request === 'vscode') {
        return __filename;
    }

    return originalResolveFilename.call(this, request, ...args);
};
