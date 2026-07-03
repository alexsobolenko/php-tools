import '../../helpers/vscode';
import assert from 'node:assert';
import {describe, it} from 'node:test';
import Yii2 from '../../../framework/yii2/service';

describe('Yii2 service', () => {
    describe('checkComposerData', () => {
        it('detects a known Yii2 package in require', () => {
            assert.strictEqual(Yii2.checkComposerData({require: {'yiisoft/yii2': '^2.0'}}), true);
        });

        it('returns false when no Yii2 package is required', () => {
            assert.strictEqual(Yii2.checkComposerData({require: {'symfony/symfony': '^6.0'}}), false);
        });

        it('returns false when there is no require section at all', () => {
            assert.strictEqual(Yii2.checkComposerData({}), false);
        });
    });

    describe('providers', () => {
        it('exposes no providers when Yii2 is not used', () => {
            const yii2 = new Yii2(false);

            assert.deepStrictEqual(yii2.providers, []);
        });

        it('exposes three CodeLens providers when Yii2 is used', () => {
            const yii2 = new Yii2(true);

            assert.strictEqual(yii2.providers.length, 3);
        });
    });
});
