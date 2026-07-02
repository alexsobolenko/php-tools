import {commands, ExtensionContext, window} from 'vscode';
import Accessor from './feature/accessor';
import Constructor from './feature/constructor';
import Fabric from './feature/fabric';
import StringConvertor from './feature/string-convertor';
import {watchComposerJson} from './service/project';
import {COMMAND, CONV, FABRIC, PROP} from './constants';

export async function activate(context: ExtensionContext) {
    /* getters-setters */
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_GETTER, () => {
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return;
        }

        new Accessor([editor.selection.active]).render([PROP.GETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_SETTER, () => {
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return;
        }

        new Accessor([editor.selection.active]).render([PROP.SETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_GETTER_SETTER, () => {
        const editor = window.activeTextEditor;
        if (!editor || editor.document.languageId !== 'php') {
            return;
        }

        new Accessor([editor.selection.active]).render([PROP.GETTER, PROP.SETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_GETTER_MASTER, async () => {
        const positions = await Accessor.selectProperties('Select properties to generate getters');
        new Accessor(positions).render([PROP.GETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_SETTER_MASTER, async () => {
        const positions = await Accessor.selectProperties('Select properties to generate setters');
        new Accessor(positions).render([PROP.SETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.INSERT_GETTER_SETTER_MASTER, async () => {
        const positions = await Accessor.selectProperties('Select properties to generate getters and setters');
        new Accessor(positions).render([PROP.GETTER, PROP.SETTER]);
    }));

    /* constructor */
    context.subscriptions.push(commands.registerCommand(COMMAND.GENERATE_CONSTRUCTOR, async () => {
        const constructor = new Constructor();
        if (await constructor.fill()) {
            constructor.render();
        }
    }));

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
        new StringConvertor(CONV.CONCATENATION).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.CONVERT_STRING_TO_SPRINTF, () => {
        new StringConvertor(CONV.SPRINTF).render();
    }));
    context.subscriptions.push(commands.registerCommand(COMMAND.CONVERT_STRING_TO_INTERPOLATION, () => {
        new StringConvertor(CONV.INTERPOLATION).render();
    }));
}

export function deactivate() {}
