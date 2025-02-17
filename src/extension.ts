import {commands, ExtensionContext} from 'vscode';
import App from './app';
import Resolver from './getters-setters/resolver';
import Builder from './fabric/builder';
import Documenter from './phpdoc/documenter';
import {
    CMD_GENERATE_ABSTRACT_CLASS,
    CMD_GENERATE_CLASS,
    CMD_GENERATE_CONSTRUCTOR,
    CMD_GENERATE_ENUM,
    CMD_GENERATE_FINAL_CLASS,
    CMD_GENERATE_INTERFACE,
    CMD_GENERATE_PHPDOC,
    CMD_GENERATE_TRAIT,
    CMD_INSERT_GETTER,
    CMD_INSERT_GETTER_SETTER,
    CMD_INSERT_SETTER,
    F_ABSTRACT_CLASS,
    F_CLASS,
    F_ENUM,
    F_FINAL_CLASS,
    F_INTERFACE,
    F_TRAIT,
    R_GETTER,
    R_SETTER,
} from './constants';
import Construct from './constructor/construct';

export function activate(context: ExtensionContext) {
    /* getters-setters */
    context.subscriptions.push(commands.registerCommand(CMD_INSERT_GETTER, () => {
        const position = App.instance.editor.selection.active;
        const resolver = new Resolver([position]);
        resolver.render([R_GETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(CMD_INSERT_SETTER, () => {
        const position = App.instance.editor.selection.active;
        const resolver = new Resolver([position]);
        resolver.render([R_SETTER]);
    }));
    context.subscriptions.push(commands.registerCommand(CMD_INSERT_GETTER_SETTER, () => {
        const position = App.instance.editor.selection.active;
        const resolver = new Resolver([position]);
        resolver.render([R_GETTER, R_SETTER]);
    }));

    /* fabric */
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_CLASS, () => {
        const builder = new Builder(F_CLASS);
        builder.render();
    }));
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_ABSTRACT_CLASS, () => {
        const builder = new Builder(F_ABSTRACT_CLASS);
        builder.render();
    }));
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_FINAL_CLASS, () => {
        const builder = new Builder(F_FINAL_CLASS);
        builder.render();
    }));
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_INTERFACE, () => {
        const builder = new Builder(F_INTERFACE);
        builder.render();
    }));
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_TRAIT, () => {
        const builder = new Builder(F_TRAIT);
        builder.render();
    }));
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_ENUM, () => {
        const builder = new Builder(F_ENUM);
        builder.render();
    }));

    /* phpdoc */
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_PHPDOC, () => {
        const position = App.instance.editor.selection.active;
        const documenter = new Documenter(position);
        documenter.render();
    }));

    /* constructor */
    context.subscriptions.push(commands.registerCommand(CMD_GENERATE_CONSTRUCTOR, async () => {
        const construct = new Construct();
        await construct.fill();
        construct.render();
    }));
}

export function deactivate() {}
