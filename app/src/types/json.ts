type Literal = string | number | boolean | null;

export type JsonValue = Literal | { [key: string]: JsonValue } | JsonValue[];
