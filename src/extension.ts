import * as vscode from 'vscode';
import {Action} from './interfaces';
import App from './app';

export function activate(context: vscode.ExtensionContext) {
    App.instance.actions().forEach((action: Action) => {
        context.subscriptions.push(vscode.commands.registerCommand(action.name, action.handler));
    });
}

export function deactivate() {}
