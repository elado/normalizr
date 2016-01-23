import isObject from 'lodash/isObject';
import UnionSchema from './UnionSchema';

export default class IterableSchema {
  constructor(itemSchema, options = {}) {
    if (!isObject(itemSchema)) {
      throw new Error('IterableSchema requires item schema to be an object.');
    }

    if (options.schemaAttribute) {
      const schemaAttribute = options.schemaAttribute;
      this._itemSchema = new UnionSchema(itemSchema, { schemaAttribute })
    } else {
      this._itemSchema = itemSchema;
    }
  }

  getItemSchema() {
    return this._itemSchema;
  }
}
