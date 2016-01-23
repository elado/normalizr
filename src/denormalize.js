import EntitySchema from './EntitySchema';
import IterableSchema from './IterableSchema';
import UnionSchema from './UnionSchema';

export default function denormalize(bag, schema, id) {
  let normalizedEntity = null

  if (schema.constructor === EntitySchema) {
    const type = schema.getKey()
    normalizedEntity = bag[type] && bag[type][id]
  } else if (schema.constructor === UnionSchema) {
    normalizedEntity = bag[id.schema] && bag[id.schema][id.id]
  } else if (schema.constructor === IterableSchema) {
    const itemSchema = schema.getItemSchema()
    return id.map(i => denormalize(bag, itemSchema, i))
  } else {
    throw new Error('no such schema type: ' + schema.constructor.name)
  }

  const instance = { ...normalizedEntity }

  const relationKeys = Object.keys(schema).filter(k => k[0] != '_')

  for (let relaionKey of relationKeys) {
    let relationId = normalizedEntity[relaionKey]
    let relationSchema = schema[relaionKey]
    let cachedValue

    Object.defineProperty(
      instance,
      relaionKey,
      {
        get() {
          if (cachedValue) return cachedValue

          let denormalizedRelation = denormalize(bag, schema[relaionKey], relationId)
          cachedValue = denormalizedRelation

          return denormalizedRelation
        }
      }
    )
  }

  return instance
}
