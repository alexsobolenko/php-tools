import {commands, ExtensionContext} from 'vscode';
import StringConvertor from './feature/string-convertor';
import {COMMAND, CONV} from './constants';

export async function activate(context: ExtensionContext) {
    /* string conversions */
    context.subscriptions.push(commands.registerCommand(COMMAND.CONVERT_STRING_TO_CONCATENATION, () => {
        const convertor = new StringConvertor(CONV.CONCATENATION);
        convertor.render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.CONVERT_STRING_TO_SPRINTF, () => {
        const convertor = new StringConvertor(CONV.SPRINTF);
        convertor.render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.CONVERT_STRING_TO_INTERPOLATION, () => {
        const convertor = new StringConvertor(CONV.INTERPOLATION);
        convertor.render();
    }));
}

export function deactivate() {}
