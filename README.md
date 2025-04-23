# PHP tools

Tools for better PHP development

## Config

### Extension parameters

- `advanced-php-tools.builder-strict-types` - Generate objects with `declare(strict_types=1)` (default: `true`)
- `advanced-php-tools.builder-generate-phpdoc` - Generate objects with phpdoc (default: `false`)
- `advanced-php-tools.setter-return-self` - Return class instance in setter instead of void (default: `false`)
- `advanced-php-tools.getter-setter-generate-phpdoc` - Generate phpdoc for getter/setter (default: `false`)
- `advanced-php-tools.phpdoc-function-show-description` - Add description to function PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-property-show-description` - Add description to property PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-constant-show-description` - Add description to constant PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-function-return-void` - Add return to PHPDoc if returns void (default: `false`)
- `advanced-php-tools.phpdoc-empty-lines-after-description` - Add empty lines after description in PHPDoc (default: `0`, ignored when description disabled)
- `advanced-php-tools.phpdoc-empty-lines-before-return` - Add empty lines before return in PHPDoc (default: `0`, ignored when return not show or there are not params)
- `advanced-php-tools.phpdoc-empty-lines-before-throws` - Add empty lines before throws in PHPDoc (default: `0`, ignored when there are not throws)
- `advanced-php-tools.phpdoc-show-throws-on-diff-lines` - Show throws on different lines (default: `true`)
- `advanced-php-tools.constructor-args-one-line-max-length` - Max length of constructor arguments when it on one line (defalut: `120`)

## Feature #1 - Generate getter and setter for class property

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/getters-setters.gif)

### Feature #1 commands

- Advanced PHP Tools. Insert getter
- Advanced PHP Tools. Insert setter
- Advanced PHP Tools. Insert getter and setter
- Advanced PHP Tools. Insert getter (Master)
- Advanced PHP Tools. Insert setter (Master)
- Advanced PHP Tools. Insert getter and setter (Master)

## Feature #2 - Generate class, interface, trait and enum

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/fabric.gif)

### Feature #2 commands

- Advanced PHP Tools. Generate class
- Advanced PHP Tools. Generate abstract class
- Advanced PHP Tools. Generate final class
- Advanced PHP Tools. Generate enum
- Advanced PHP Tools. Generate interface
- Advanced PHP Tools. Generate trait

## Feature #3 - Generate PHPDoc

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/phpdoc.gif)

### Feature #3 commands

- Advanced PHP Tools. Generate PHPDoc [default key: `ctrl+enter`]
- Advanced PHP Tools. Generate PHPDoc (Master)

## Feature #4 - Generate constructor from selected properties

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/construct.gif)

### Feature #4 commands

- Advanced PHP Tools. Generate class constructor

## Feature #5 - Symfony support

- Open class configuration in `config/services.yaml`

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-services.gif)

- Open class declaration from `config/services.yaml`

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-services-yaml.gif)

- Open twig template

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-templates.gif)

## Feature #6 - Yii2 support

### In progress 🙃
