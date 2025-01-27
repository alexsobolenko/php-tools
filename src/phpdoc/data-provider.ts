export const P_TYPE_FUNCTION = 'function';
// eslint-disable-next-line max-len
export const P_REGEX_FUNCTION = /^\s*(public|protected|private|static|final)?\s*(static|final)?\s*function\s+\w+\s*(\([^)]*\))?\s*(?::\s*\??\s*[\w\\]+)?\s*/u;

export const P_TYPE_CLASS = 'class';
export const P_REGEX_CLASS = /(class|interface|trait|enum)\s+(\w+)\s?/u;

export const P_TYPE_CONSTANT = 'constant';
// eslint-disable-next-line max-len
export const P_REGEX_CONSTANT = /(\s+)?(?:(?:public|protected|private)\s+)?const\s+?((?:\??[\w\\|]+))\s*(\w+)\s*=\s*([\p{Alpha}\p{M}\p{Nd}\p{Pc}\p{Join_C}\s$=:.,%*--+'"?><\\[\]]+)?/u;

export const P_TYPE_PROPERTY = 'property';
// eslint-disable-next-line max-len
export const P_REGEX_PROPERTY = /(\s+)?(?:public|protected|private)\s+(?:static\s+)?((?:\??[\w\\|]+)\s+)?(\$\w+)(?:\s*=\s*([^;]+))?;/u;
