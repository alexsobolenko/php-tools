# PHP tools

Tools for better PHP development

## Feature #1 - Generate getter and setter for class property

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
