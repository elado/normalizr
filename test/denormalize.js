import { normalize, denormalize, Schema, arrayOf, unionOf } from '../src'
import _ from 'lodash'
import expect from 'expect'

describe('denormalize', function () {
  it('denormalizes an entity with its relationships', function () {
    const messageSchema = new Schema('message')
    const userSchema = new Schema('user')

    messageSchema.define({
      sender: userSchema,
      recipient: userSchema
    })

    const message = {
      id: 'm1',
      body: 'body1',
      sender: {
        id: 'u1',
        name: 'some-sender'
      },
      recipient: {
        id: 'u2',
        name: 'some-recipient'
      }
    }

    const normalized = normalize(message, messageSchema)

    const denormalizedMessage = denormalize(normalized.entities, messageSchema, 'm1')

    expect(denormalizedMessage).toEqual(message)

    expect(denormalizedMessage.sender).toEqual(message.sender)
    expect(denormalizedMessage.sender.id).toEqual('u1')
    expect(denormalizedMessage.sender.name).toEqual('some-sender')

    expect(denormalizedMessage.recipient).toEqual(message.recipient)
    expect(denormalizedMessage.recipient.id).toEqual('u2')
    expect(denormalizedMessage.recipient.name).toEqual('some-recipient')
  })

  it('denormalizes an array of entities', function () {
    const articleSchema = new Schema('article')
    const userSchema = new Schema('user')

    articleSchema.define({
      author: userSchema,
    })

    const articles = [
      {
        id: 'a1',
        title: 'title1',
        author: {
          id: 'u1',
          name: 'some-author 1'
        }
      },
      {
        id: 'a2',
        title: 'title2',
        author: {
          id: 'u3',
          name: 'some-author 3'
        }
      },
      {
        id: 'a3',
        title: 'title3',
        author: {
          id: 'u3',
          name: 'some-author 3'
        }
      }
    ]

    const normalized = normalize(articles, arrayOf(articleSchema))

    const denormalizedArticles = denormalize(normalized.entities, arrayOf(articleSchema), ['a1', 'a2', 'a3'])

    expect(denormalizedArticles.length).toEqual(3)
    expect(denormalizedArticles[0]).toEqual(articles[0])
    expect(denormalizedArticles[0].author).toEqual(articles[0].author)
  })

  it('denormalizes a relationship array', function () {
    const userSchema = new Schema('user')
    const articleSchema = new Schema('article')

    userSchema.define({
      articles: arrayOf(articleSchema)
    })

    const user = {
      id: 'u1',
      name: 'some-user',
      articles: [
        { id: 'm1', body: 'm1' },
        { id: 'm2', body: 'm2' },
        { id: 'm3', body: 'm3' }
      ]
    }

    const normalized = normalize(user, userSchema)

    const denormalizedUser = denormalize(normalized.entities, userSchema, 'u1')

    expect(denormalizedUser).toEqual(user)
    expect(denormalizedUser.articles).toEqual(user.articles)
  })

  it('outputs relationships as denormalized entities', function () {
    const userSchema = new Schema('user')
    const articleSchema = new Schema('article')
    const categorySchema = new Schema('category')

    userSchema.define({
      articles: arrayOf(articleSchema)
    })

    articleSchema.define({
      category: categorySchema
    })

    const user = {
      id: 'u1',
      name: 'some-user',
      articles: [
        { id: 'm1', body: 'm1', category: { id: 'c1', body: 'c1' } },
        { id: 'm2', body: 'm2', category: { id: 'c2', body: 'c2' } },
        { id: 'm3', body: 'm3', category: { id: 'c3', body: 'c3' } },
      ]
    }

    const normalized = normalize(user, userSchema)

    const denormalizedUser = denormalize(normalized.entities, userSchema, 'u1')

    expect(denormalizedUser).toEqual(user)
    expect(denormalizedUser.articles).toEqual(user.articles)
    expect(denormalizedUser.articles[0].category).toEqual(user.articles[0].category)
  })

  it('refetches from store if a relationship entity changed in store', function () {
    const articleSchema = new Schema('article')
    const categorySchema = new Schema('category')

    articleSchema.define({
      category: categorySchema
    })

    const article = {
      id: 'a1',
      body: 'a1',
      category: {
        id: 'c1',
        name: 'c1'
      }
    }

    let bag = {}
    let normalized = normalize(article, articleSchema)
    bag = _.merge({}, bag, normalized.entities)

    let denormalizedArticle = denormalize(bag, articleSchema, 'a1')

    expect(denormalizedArticle.category).toEqual(article.category)

    const updatedCategory = { id: 'c1', name: 'c1 update' }

    normalized = normalize(updatedCategory, categorySchema)
    bag = _.merge({}, bag, normalized.entities)

    // need to denormalize again with new bag
    denormalizedArticle = denormalize(bag, articleSchema, 'a1')
    expect(denormalizedArticle.category).toEqual(updatedCategory)
  })

  it('denormalizes all nested entities with bidirectional relationships without causing infinite loops', function () {
    const articleSchema = new Schema('article')
    const userSchema = new Schema('user')

    articleSchema.define({
      author: userSchema,
    })

    userSchema.define({
      articles: arrayOf(articleSchema),
    })

    const user =  {
      id: 'u1',
      name: 'author1'
    }

    const articles = [
      { id: 'a1', title: 'title1', author: { id: 'u1' } },
      { id: 'a2', title: 'title2', author: { id: 'u1' } },
    ]

    user.articles = articles

    const normalized = normalize(user, userSchema)

    const denormalizedUser = denormalize(normalized.entities, userSchema, 'u1')

    expect(denormalizedUser.id).toEqual(user.id)
    expect(denormalizedUser.articles.map(a => a.id)).toEqual(user.articles.map(a => a.id))
    expect(denormalizedUser.articles[0].author.id).toEqual(user.id)
    expect(denormalizedUser.articles[0].author.articles[0].id).toEqual(user.articles[0].id)
    expect(denormalizedUser.articles[0].author.articles[0].author.articles[1].id).toEqual(user.articles[1].id)
  })

  it('denormalizes polymorphic relationship', function () {
    const messageSchema = new Schema('message')
    const userSchema = new Schema('user')
    const groupSchema = new Schema('group')
    const counterPartyUnion = {
      user: userSchema,
      group: groupSchema
    }

    messageSchema.define({
      counterParty: unionOf(counterPartyUnion, { schemaAttribute: 'type' }),
    })

    const messageWithUser = {
      id: 'm1',
      body: 'body1',
      counterParty: {
        id: 'u1',
        name: 'some-user',
        type: 'user'
      }
    }

    const messageWithGroup = {
      id: 'm2',
      body: 'body2',
      counterParty: {
        id: 'g2',
        name: 'some-group',
        type: 'group'
      }
    }

    const normalized = normalize([messageWithUser, messageWithGroup], arrayOf(messageSchema))

    const denormalizedMessageWithUser = denormalize(normalized.entities, messageSchema, 'm1')

    expect(denormalizedMessageWithUser).toEqual(messageWithUser)
    expect(denormalizedMessageWithUser.counterParty).toEqual(messageWithUser.counterParty)
    expect(denormalizedMessageWithUser.counterParty.id).toEqual('u1')
    expect(denormalizedMessageWithUser.counterParty.name).toEqual('some-user')

    const denormalizedMessageWithGroup = denormalize(normalized.entities, messageSchema, 'm2')

    expect(denormalizedMessageWithGroup).toEqual(messageWithGroup)
    expect(denormalizedMessageWithGroup.counterParty).toEqual(messageWithGroup.counterParty)
    expect(denormalizedMessageWithGroup.counterParty.id).toEqual('g2')
    expect(denormalizedMessageWithGroup.counterParty.name).toEqual('some-group')
  })

  it('denormalizes a relationship array of polymorphic relationships', function () {
    const groupSchema = new Schema('group')
    const userSchema = new Schema('user')
    const botSchema = new Schema('bot')
    const groupMemberUnion = {
      user: userSchema,
      bot: botSchema
    }

    groupSchema.define({
      members: arrayOf(unionOf(groupMemberUnion, { schemaAttribute: 'type' })),
    })

    const group = {
      id: 'g1',
      name: 'name1',
      members: [
        { id: 'u1', type: 'user', name: 'user1' },
        { id: 'b1', type: 'bot', name: 'user1' },
        { id: 'u2', type: 'user', name: 'user2' },
        { id: 'b2', type: 'bot', name: 'user2' },
      ]
    }

    const normalized = normalize(group, groupSchema)

    const denormalizedGroup = denormalize(normalized.entities, groupSchema, 'g1')
  })
})
