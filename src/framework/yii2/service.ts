import {CodeLensProvider} from 'vscode';
import {IComposerData} from '../../interfaces';
import {Yii2ConfigToClassProvider, Yii2DiProvider, Yii2ViewProvider} from './providers';

export default class Yii2 {
    public used: boolean;

    public constructor(used: boolean) {
        this.used = used;
    }

    public static checkComposerData(data: IComposerData): boolean {
        const requireLibs = Object.keys(data.require || {});
        const yii2Libs = ['yiisoft/yii2', 'yiisoft/yii2-bootstrap', 'yii2mod/yii2-settings', 'yii2tech/yii2-admin'];
        const yii2LibsSet = new Set(yii2Libs);

        return requireLibs.filter((lib) => yii2LibsSet.has(lib)).length > 0;
    }

    public get providers(): Array<{selector: Object, provider: CodeLensProvider}> {
        if (!this.used) {
            return [];
        }

        return [
            {
                selector: {language: 'php', scheme: 'file'},
                provider: new Yii2ViewProvider(this),
            },
            {
                selector: {language: 'php'},
                provider: new Yii2DiProvider(this),
            },
            {
                selector: {language: 'php'},
                provider: new Yii2ConfigToClassProvider(this),
            },
        ];
    }

    public get diConfigFiles(): Array<string> {
        return [
            'config/web.php',
            'config/web-local.php',
            'config/main.php',
            'config/main-local.php',
            'common/config/main.php',
            'common/config/main-local.php',
        ];
    }
}
