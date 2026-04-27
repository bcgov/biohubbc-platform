export class BaseError extends Error {
  // Realm-stable identity brand. Each subclass intended for cross-module
  // `instanceof` (in ESM-duplicating environments such as tsx-watch hot-reload
  // or split loader contexts) declares its own
  // `static readonly brand = Symbol.for('@biohub/error/<ClassName>')`. The
  // global symbol registry is shared across all module instances, so the same
  // string resolves to one symbol regardless of how many copies of the class
  // exist. See the `Symbol.hasInstance` override below.
  static readonly brand: symbol = Symbol.for('@biohub/error/BaseError');

  errors: (string | object)[] = [];

  constructor(name: string, message: string, errors?: (string | object)[], stack?: string) {
    super(message);

    this.name = name;

    // Mark `this` with the brand of every class in `new.target`'s static
    // inheritance chain that declares its own brand. The `Symbol.hasInstance`
    // override below uses these brands instead of class identity, so subclass
    // instances correctly match `instanceof Parent` across module boundaries.
    let cls: unknown = new.target;
    while (cls && cls !== Function.prototype) {
      if (Object.prototype.hasOwnProperty.call(cls, 'brand')) {
        const brand = (cls as { brand: unknown }).brand;
        if (typeof brand === 'symbol') {
          Object.defineProperty(this, brand, { value: true, enumerable: false });
        }
      }
      cls = Object.getPrototypeOf(cls);
    }

    for (const error of errors ?? []) {
      if (error instanceof Error) {
        // By default, properties of Error objects are not enumerable, so we need to manually extract them.
        this.errors.push({ name: error.name, message: error.message });
      } else {
        this.errors.push(error);
      }
    }

    // If a stack is provided, use it. Otherwise, generate a new stack trace.
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, new.target);
    }
  }

  // ESM-resilient `instanceof`.
  //
  // The default `instanceof` is identity-based: it checks whether the
  // candidate's prototype chain contains *the specific* class object in scope
  // at the call site. ESM caches modules by URL, so different specifiers
  // (query strings, hot-reload, loader splits) can produce two distinct copies
  // of a class in the same process — and `instanceof` returns false across
  // them.
  //
  // For classes that declare an OWN `static readonly brand` (registered via
  // `Symbol.for(...)` so the symbol is shared across all module instances),
  // dispatch on the brand rather than class identity. The constructor marks
  // each instance with the brands of every class in its hierarchy; this check
  // verifies the candidate carries `this`'s own brand.
  //
  // Classes that don't declare an own brand (e.g. ad-hoc test fixtures) fall
  // back to a manual prototype-identity check that mirrors the default
  // `instanceof` semantics. This keeps single-module usage intuitive while
  // letting branded classes opt into the cross-module guarantee.
  static [Symbol.hasInstance](candidate: unknown): boolean {
    if (candidate === null || typeof candidate !== 'object') {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(this, 'brand')) {
      const brand = (this as unknown as { brand: unknown }).brand;
      if (typeof brand === 'symbol') {
        return (candidate as Record<symbol, unknown>)[brand] === true;
      }
    }

    const targetPrototype = (this as unknown as { prototype?: object }).prototype;
    if (!targetPrototype) {
      return false;
    }
    let proto = Object.getPrototypeOf(candidate);
    while (proto !== null) {
      if (proto === targetPrototype) {
        return true;
      }
      proto = Object.getPrototypeOf(proto);
    }
    return false;
  }
}
