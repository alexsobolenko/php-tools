import {commands, ExtensionContext} from 'vscode';
import Fabric from './feature/fabric';
import StringConvertor from './feature/string-convertor';
import {watchComposerJson} from './service/project';
import {COMMAND, CONV, FABRIC} from './constants';

export async function activate(context: ExtensionContext) {
    /* fabric */
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_CLASS, () => {
        new Fabric(FABRIC.CLASS).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_ABSTRACT_CLASS, () => {
        new Fabric(FABRIC.ABSTRACT_CLASS).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_FINAL_CLASS, () => {
        new Fabric(FABRIC.FINAL_CLASS).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_INTERFACE, () => {
        new Fabric(FABRIC.INTERFACE).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_TRAIT, () => {
        new Fabric(FABRIC.TRAIT).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_ENUM, () => {
        new Fabric(FABRIC.ENUM).render();
    }));
    context.subscriptions.push(watchComposerJson());

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
