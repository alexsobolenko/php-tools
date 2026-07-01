export const EXT_ID = 'advanced-php-tools';

/* commands */
export const COMMAND = {
    INSERT_GETTER: 'advanced-php-tools.insert-getter',
    INSERT_SETTER: 'advanced-php-tools.insert-setter',
    INSERT_GETTER_SETTER: 'advanced-php-tools.insert-getter-setter',
    INSERT_GETTER_MASTER: 'advanced-php-tools.insert-getter-master',
    INSERT_SETTER_MASTER: 'advanced-php-tools.insert-setter-master',
    INSERT_GETTER_SETTER_MASTER: 'advanced-php-tools.insert-getter-setter-master',

    GENERATE_CLASS: 'advanced-php-tools.generate-class',
    GENERATE_ABSTRACT_CLASS: 'advanced-php-tools.generate-abstract-class',
    GENERATE_FINAL_CLASS: 'advanced-php-tools.generate-final-class',
    GENERATE_ENUM: 'advanced-php-tools.generate-enum',
    GENERATE_INTERFACE: 'advanced-php-tools.generate-interface',
    GENERATE_TRAIT: 'advanced-php-tools.generate-trait',

    GENERATE_PHPDOC: 'advanced-php-tools.generate-php-doc',
    GENERATE_PHPDOC_MASTER: 'advanced-php-tools.generate-php-doc-master',

    GENERATE_CONSTRUCTOR: 'advanced-php-tools.generate-constructor',

    SYMFONY_CREATE_SERVICE: 'advanced-php-tools.symfony-create-service',

    CONVERT_STRING_TO_CONCATENATION: 'advanced-php-tools.convert-string-to-concatenation',
    CONVERT_STRING_TO_SPRINTF: 'advanced-php-tools.convert-string-to-sprintf',
    CONVERT_STRING_TO_INTERPOLATION: 'advanced-php-tools.convert-string-to-interpolation',
};

/* string conversion */
export const CONV = {
    CONCATENATION: 's_concatenation',
    INTERPOLATION: 's_interpolation',
    SPRINTF: 's_sprintf',
};

/* parameters */
export const DOC_CONST_DESCR = 'phpdoc-constant-show-description';
export const DOC_LINES_AFTER_DESCR = 'phpdoc-empty-lines-after-description';
export const DOC_LINES_BEFORE_RETURN = 'phpdoc-empty-lines-before-return';
export const DOC_LINES_BEFORE_THROWS = 'phpdoc-empty-lines-before-throws';
export const DOC_PROPERTY_DESCR = 'phpdoc-property-show-description';
export const DOC_RETURN_VOID = 'phpdoc-function-return-void';
export const DOC_SHOW_DESCR = 'phpdoc-function-show-description';
export const DOC_SHOW_THROWS_ON_DIFF_LINES = 'phpdoc-show-throws-on-diff-lines';
export const FAB_GENERATE_PHPDOC = 'builder-generate-phpdoc';
export const FAB_STRICT_TYPES = 'builder-strict-types';
export const GS_GENERATE_PHPDOC = 'getter-setter-generate-phpdoc';
export const GS_RETURN_SELF = 'setter-return-self';
export const CONSTRUCT_ARGS_MAX_LENGTH = 'constructor-args-one-line-max-length';

/* messages */
export const MESSAGE = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info',
};

/* getters-setters */
export const PROP = {
    GETTER: 'r_getter',
    SETTER: 'r_setter',
    UNDEFINED: '__undefined__',
};

/* fabric */
export const FABRIC = {
    CLASS: 'b_class',
    ABSTRACT_CLASS: 'b_abstract_class',
    FINAL_CLASS: 'b_final_class',
    INTERFACE: 'b_interface',
    TRAIT: 'b_trait',
    ENUM: 'b_enum',
    UNDEFINED_TYPE: '__undefined__',
};


/* phpdoc */
export const PHPDOC = {
    FUNCTION: {
        TYPE: 'function',
        // eslint-disable-next-line max-len
        REGEX: /^\s*(?:(?:abstract|final|public|protected|private|static)\s+){0,3}function\s+(\w+)\s*(\([^)]*\))?\s*(?::\s*\??\s*[\w\\]+)?/u,
    },
    CLASS: {
        TYPE: 'class',
        REGEX: /(class|interface|trait|enum)\s+(\w+)\s?/u,
    },
    CONSTANT: {
        TYPE: 'constant',
        // eslint-disable-next-line max-len
        REGEX: /(\s+)?(?:(?:public|protected|private)\s+)?const\s+?((?:\??[\w\\|]+))\s*(\w+)\s*=\s*([\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}\s$=:.,%*--+'"?><\\[\]]+)?/u,
    },
    PROPERTY: {
        TYPE: 'property',
        // eslint-disable-next-line max-len
        REGEX: /(\s+)?(?:(?:public|protected|private)\s+)(?:(?:static|readonly)\s+)?((?:\??[\w\\|]+)\s+)?(\$\w+)(?:\s*=\s*([^;]+))?;?/u,
    },
    VALID_KLASS: ['class', 'interface', 'trait', 'enum'],
};
