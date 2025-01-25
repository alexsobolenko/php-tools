# PHP tools

Tools for better PHP development

## Feature #1 - Generate getter and setter for class property

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/getters-setters.gif)

### Available commands:
- PHP Tools. Insert getter
- PHP Tools. Insert setter
- PHP Tools. Insert getter and setter

### Available configuration parameters:
- `advanced-php-tools.getter-setter-generate-phpdoc` - Generate phpdoc for getter/setter (default: `false`)
- `advanced-php-tools.getter-setter-show-description` - Add description for getter/setter (default: `false`)
- `advanced-php-tools.getter-setter-empty-lines-before-params` - Add empty lines before params in getter/setter phpdoc (default: `0`, ignored in setter when description not shown)
- `advanced-php-tools.getter-setter-empty-lines-before-return` - Add empty lines before return in getter/setter phpdoc (default: `0`, ignored in getter when description not shown, ignored in setter when retunrs void)
- `advanced-php-tools.getter-setter-return-self` - Return class instance in setter instead of void (default: `false`)

## Feature #2 - Generate class, interface, trait and enum

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/fabric.gif)

### Available commands:
- PHP Tools. Generate class
- PHP Tools. Generate abstract class
- PHP Tools. Generate final class
- PHP Tools. Generate enum
- PHP Tools. Generate interface
- PHP Tools. Generate trait

### Available configuration parameters:
- `advanced-php-tools.builder-strict-types` - Generate objects with `declare(strict_types=1)` (default: `true`)
- `advanced-php-tools.builder-generate-phpdoc` - Generate objects with phpdoc (default: `false`)

## Feature #3 - Generate PHPDoc

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/phpdoc.gif)

### Available commands:
- PHP Tools. Generate PHPDoc (default key: `ctrl+alt+d`)

### Available configuration parameters:
- `advanced-php-tools.phpdoc-function-show-description` - Add description to function PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-function-return-void` - Add return to PHPDoc if returns void (default: `false`)
- `advanced-php-tools.phpdoc-property-show-description` - Add description to property PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-constant-show-description` - Add description to constant PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-empty-lines-after-description` - Add empty lines after description in PHPDoc (default: `0`, ignored when description disabled)
- `advanced-php-tools.phpdoc-empty-lines-before-return` - Add empty lines before return in PHPDoc (default: `0`, ignored when return not show)
