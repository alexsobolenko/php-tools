/* commands */
export const CMD_INSERT_GETTER = 'advanced-php-tools.insert-getter';
export const CMD_INSERT_SETTER = 'advanced-php-tools.insert-setter';
export const CMD_INSERT_GETTER_SETTER = 'advanced-php-tools.insert-getter-setter';

export const CMD_GENERATE_CLASS = 'advanced-php-tools.generate-class';
export const CMD_GENERATE_ABSTRACT_CLASS = 'advanced-php-tools.generate-abstract-class';
export const CMD_GENERATE_FINAL_CLASS = 'advanced-php-tools.generate-final-class';
export const CMD_GENERATE_ENUM = 'advanced-php-tools.generate-enum';
export const CMD_GENERATE_INTERFACE = 'advanced-php-tools.generate-interface';
export const CMD_GENERATE_TRAIT = 'advanced-php-tools.generate-trait';

export const CMD_GENERATE_PHPDOC = 'advanced-php-tools.generate-php-doc';

/* parameters */
export const A_DOC_CONST_DESCR = 'phpdoc-constant-show-description';
export const A_DOC_LINES_AFTER_DESCR = 'phpdoc-empty-lines-after-description';
export const A_DOC_LINES_BEFORE_RETURN = 'phpdoc-empty-lines-before-return';
export const A_DOC_PROPERTY_DESCR = 'phpdoc-property-show-description';
export const A_DOC_RETURN_VOID = 'phpdoc-function-return-void';
export const A_DOC_SHOW_DESCR = 'phpdoc-function-show-description';

export const A_FAB_GENERATE_PHPDOC = 'builder-generate-phpdoc';
export const A_FAB_STRICT_TYPES = 'builder-strict-types';

export const A_GS_GENERATE_PHPDOC = 'getter-setter-generate-phpdoc';
export const A_GS_RETURN_SELF = 'setter-return-self';

/* getters-setters */
export const R_GETTER = 'r_getter';
export const R_SETTER = 'r_setter';

export const R_UNDEFINED_PROPERTY = '__undefined__';

/* phpdoc */
export const D_TYPE_FUNCTION = 'function';
// eslint-disable-next-line max-len
export const D_REGEX_FUNCTION = /^\s*(public|protected|private|static|final)?\s*(static|final)?\s*function\s+\w+\s*(\([^)]*\))?\s*(?::\s*\??\s*[\w\\]+)?\s*/u;

export const D_TYPE_CLASS = 'class';
export const D_REGEX_CLASS = /(class|interface|trait|enum)\s+(\w+)\s?/u;

export const D_TYPE_CONSTANT = 'constant';
// eslint-disable-next-line max-len
export const D_REGEX_CONSTANT = /(\s+)?(?:(?:public|protected|private)\s+)?const\s+?((?:\??[\w\\|]+))\s*(\w+)\s*=\s*([\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}\s$=:.,%*--+'"?><\\[\]]+)?/u;

export const D_TYPE_PROPERTY = 'property';
// eslint-disable-next-line max-len
export const D_REGEX_PROPERTY = /(\s+)?(?:public|protected|private)\s+(?:static\s+)?((?:\??[\w\\|]+)\s+)?(\$\w+)(?:\s*=\s*([^;]+))?;/u;
