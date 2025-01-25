import * as vscode from 'vscode';
import {IAction} from './interfaces';
import App from './app';

export function activate(context: vscode.ExtensionContext) {
    App.instance.actions().forEach((action: IAction) => {
        context.subscriptions.push(vscode.commands.registerCommand(action.name, action.handler));
    });
}

export function deactivate() {}
