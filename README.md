# PHP Tools

A comprehensive extension for PHP development in Visual Studio Code that boosts productivity with smart code generation and framework-specific tooling.

## Key Features

### 1. Getter/Setter Generation

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/getters-setters.gif)

Automatically generate getters and setters for class properties with configurable options:
- Supports both traditional and fluent (return $this) setter styles
- Configurable PHPDoc generation
- Multiple generation strategies (single/multiple properties at once)

**Commands:**
- `Advanced PHP Tools: Insert getter`
- `Advanced PHP Tools: Insert setter`
- `Advanced PHP Tools: Insert getter and setter`
- `Advanced PHP Tools: Insert getter (Master)`
- `Advanced PHP Tools: Insert setter (Master)`
- `Advanced PHP Tools: Insert getter and setter (Master)`

### 2. Class/Object Generation

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/fabric.gif)

Quickly scaffold various PHP constructs with proper syntax and structure:
- Regular, abstract and final classes
- Interfaces and traits
- Enums (PHP 8.1+)
- Automatic namespace detection
- Configurable strict types declaration

**Commands:**
- `Advanced PHP Tools: Generate class`
- `Advanced PHP Tools: Generate abstract class`
- `Advanced PHP Tools: Generate final class`
- `Advanced PHP Tools: Generate enum`
- `Advanced PHP Tools: Generate interface`
- `Advanced PHP Tools: Generate trait`

### 3. PHPDoc Generation

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/phpdoc.gif)

Intelligent documentation generation with customizable formatting:
- Function/method documentation
- Property documentation
- Configurable empty lines and spacing
- Return type and throws annotation support
- Description generation options

**Commands:**
- `Advanced PHP Tools: Generate PHPDoc` (default keybind: `Ctrl+Enter`)
- `Advanced PHP Tools: Generate PHPDoc (Master)`

### 4. Constructor Generation

![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/construct.gif)

Convert class properties to constructor arguments with:
- Automatic type inference
- Property promotion support (PHP 8.0+)
- Configurable line length formatting
- PHPDoc generation options

**Command:**
- `Advanced PHP Tools: Generate class constructor`

### 5. Symfony Framework Support
Specialized tools for Symfony development:

- Service configuration navigation (jump between service.yaml and class)
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-services-yaml.gif)

- Quick access to service definitions
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-services.gif)

- Twig template navigation
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/symfony-templates.gif)

### 6. Yii2 Framework Support
Specialized tools for Yii2 development:

- Service configuration navigation (jump from configuration to class)
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/yii2-config-to-class.gif)

- Quick access to service definitions (jump from class to configuration)
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/yii2-class-to-config.gif)

- View template navigation from controller
![Example](https://raw.githubusercontent.com/alexsobolenko/php-tools/master/assets/gifs/yii2-views.gif)

## Configuration Options

Customize the extension behavior through these settings:

- `advanced-php-tools.builder-strict-types` - Add `declare(strict_types=1)` (default: `true`)
- `advanced-php-tools.builder-generate-phpdoc` - Generate objects with phpdoc (default: `false`)
- `advanced-php-tools.setter-return-self` - Make setters return `$this` for fluent interfaces (default: `false`)
- `advanced-php-tools.getter-setter-generate-phpdoc` - Generate phpdoc for getter/setter (default: `false`)
- `advanced-php-tools.phpdoc-function-show-description` - Add descriptions to function docs (default: `false`)
- `advanced-php-tools.phpdoc-property-show-description` - Add description to property PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-constant-show-description` - Add description to constant PHPDoc (default: `false`)
- `advanced-php-tools.phpdoc-function-return-void` - Add return to PHPDoc if returns void (default: `false`)
- `advanced-php-tools.phpdoc-empty-lines-after-description` - Control spacing after descriptions (default: `0`)
- `advanced-php-tools.phpdoc-empty-lines-before-return` - Add empty lines before return in PHPDoc (default: `0`, ignored when return not show or there are not params)
- `advanced-php-tools.phpdoc-empty-lines-before-throws` - Add empty lines before throws in PHPDoc (default: `0`, ignored when there are not throws)
- `advanced-php-tools.phpdoc-show-throws-on-diff-lines` - Format throws on separate lines (default: `true`)
- `advanced-php-tools.constructor-args-one-line-max-length` - Line length threshold for single-line constructors (default: `120`)

## Keyboard Shortcuts

Default keybindings can be customized in VS Code settings:
- PHPDoc generation: `Ctrl+Enter` (Windows/Linux) / `Cmd+Enter` (Mac)
